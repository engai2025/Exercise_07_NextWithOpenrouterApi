import { getPineconeClient } from '@/lib/pinecone';

const EMBEDDING_PROVIDER =
  process.env.EMBEDDING_PROVIDER ?? 'cohere';
const PINECONE_EMBEDDING_MODEL =
  process.env.PINECONE_EMBEDDING_MODEL ?? 'llama-text-embed-v2';
const COHERE_EMBEDDING_MODEL =
  process.env.COHERE_EMBEDDING_MODEL ?? 'embed-english-v3.0';

/** Stay well under Pinecone free-tier 250k TPM. */
const PINECONE_BATCH_SIZE = 8;
const PINECONE_TARGET_TPM = 180_000;
const COHERE_BATCH_SIZE = 96;
const MAX_RETRIES = 6;

function estimateTokens(texts: string[]): number {
  return texts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('429') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('rate') ||
    message.includes('tokens per minute')
  );
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === MAX_RETRIES - 1) {
        throw error;
      }

      const delayMs = Math.min(60_000, 2_000 * 2 ** attempt);
      console.warn(
        `Embedding rate limited; retrying in ${Math.round(delayMs / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}

async function embedWithPinecone(
  texts: string[],
  inputType: 'passage' | 'query'
): Promise<number[][]> {
  const client = getPineconeClient();
  const embeddings: number[][] = [];
  let windowStart = Date.now();
  let tokensInWindow = 0;

  for (let i = 0; i < texts.length; i += PINECONE_BATCH_SIZE) {
    const batch = texts.slice(i, i + PINECONE_BATCH_SIZE);
    const batchTokens = estimateTokens(batch);

    const elapsed = Date.now() - windowStart;
    if (elapsed >= 60_000) {
      windowStart = Date.now();
      tokensInWindow = 0;
    }

    if (tokensInWindow + batchTokens > PINECONE_TARGET_TPM) {
      const waitMs = Math.max(1_000, 60_000 - elapsed + 500);
      console.log(
        `Pacing Pinecone embeddings: waiting ${Math.round(waitMs / 1000)}s to stay under TPM limit`
      );
      await sleep(waitMs);
      windowStart = Date.now();
      tokensInWindow = 0;
    }

    const result = await withRetry(() =>
      client.inference.embed({
        model: PINECONE_EMBEDDING_MODEL,
        inputs: batch,
        parameters: {
          inputType,
          truncate: 'END',
        },
      })
    );

    for (const item of result.data) {
      if (!('values' in item) || !item.values) {
        throw new Error('Pinecone embedding response missing dense values');
      }
      embeddings.push(item.values);
    }

    tokensInWindow += batchTokens;
    console.log(
      `Embedded ${Math.min(i + batch.length, texts.length)}/${texts.length} chunks via Pinecone`
    );
  }

  return embeddings;
}

async function embedWithCohere(
  texts: string[],
  inputType: 'passage' | 'query'
): Promise<number[][]> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    throw new Error('COHERE_API_KEY environment variable is required for embeddings');
  }

  const embeddings: number[][] = [];
  const cohereInputType =
    inputType === 'query' ? 'search_query' : 'search_document';

  for (let i = 0; i < texts.length; i += COHERE_BATCH_SIZE) {
    const batch = texts.slice(i, i + COHERE_BATCH_SIZE);

    const data = await withRetry(async () => {
      const response = await fetch('https://api.cohere.com/v2/embed', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: COHERE_EMBEDDING_MODEL,
          texts: batch,
          input_type: cohereInputType,
          embedding_types: ['float'],
          truncate: 'END',
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const details =
          payload?.message ||
          payload?.error?.message ||
          JSON.stringify(payload) ||
          response.statusText;
        throw new Error(`Cohere embed failed (${response.status}): ${details}`);
      }

      return payload;
    });

    const floats: number[][] = data?.embeddings?.float ?? [];
    if (floats.length !== batch.length) {
      throw new Error(
        `Cohere returned ${floats.length} embeddings for ${batch.length} inputs`
      );
    }

    embeddings.push(...floats);
    console.log(
      `Embedded ${Math.min(i + batch.length, texts.length)}/${texts.length} chunks via Cohere`
    );
  }

  return embeddings;
}

async function embedTexts(
  texts: string[],
  inputType: 'passage' | 'query'
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  if (EMBEDDING_PROVIDER === 'pinecone') {
    return embedWithPinecone(texts, inputType);
  }

  return embedWithCohere(texts, inputType);
}

export async function generateEmbeddings(
  chunks: string[]
): Promise<Array<{ content: string; embedding: number[] }>> {
  const embeddings = await embedTexts(chunks, 'passage');

  return chunks.map((chunk, index) => ({
    content: chunk,
    embedding: embeddings[index],
  }));
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text], 'query');
  return embedding;
}
