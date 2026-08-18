import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createCohere } from '@ai-sdk/cohere';

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const cohere = createCohere({
  apiKey: process.env.COHERE_API_KEY,
});

const chatProvider = process.env.CHAT_PROVIDER ?? 'cohere';

export const chatModel =
  chatProvider === 'openrouter'
    ? openrouter.chat(process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini')
    : cohere(process.env.COHERE_CHAT_MODEL ?? 'command-r-plus-08-2024');

export const embeddingModel = openrouter.embedding(
  process.env.OPENROUTER_EMBEDDING_MODEL ?? 'openai/text-embedding-3-small'
);
