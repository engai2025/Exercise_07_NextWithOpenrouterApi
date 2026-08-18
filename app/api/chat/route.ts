import { streamText, UIMessage, convertToModelMessages, createIdGenerator, validateUIMessages } from 'ai';
import { chatModel } from '@/lib/ai/openrouter';
import { getDocument, connectDB, saveMessage } from '@/lib/mongodb';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { searchSimilarVectors } from '@/lib/pinecone';
import { rerankWithCohere } from '@/lib/ai/rerank';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const chatProvider = process.env.CHAT_PROVIDER ?? 'cohere';

    if (chatProvider === 'openrouter' && !process.env.OPENROUTER_API_KEY) {
      return new Response('OPENROUTER_API_KEY is not configured', { status: 500 });
    }

    if (chatProvider !== 'openrouter' && !process.env.COHERE_API_KEY) {
      return new Response('COHERE_API_KEY is not configured', { status: 500 });
    }

    const body = await req.json();
    const { messages, message: singleMessage, selectedDocumentId } = body;

    if (!selectedDocumentId) {
      return new Response('Document ID is required', { status: 400 });
    }

    let allMessages: UIMessage[];
    let messageText: string;

    if (singleMessage) {
      allMessages = [singleMessage];
      messageText = singleMessage.parts?.find((part: any) => part.type === 'text')?.text || singleMessage.content || '';
    } else if (messages && messages.length > 0) {
      allMessages = messages;
      const latestMessage = messages[messages.length - 1];
      messageText = latestMessage.parts?.find((part: any) => part.type === 'text')?.text || latestMessage.content || '';
    } else {
      return new Response('No messages provided', { status: 400 });
    }

    let validatedMessages: UIMessage[];
    try {
      validatedMessages = await validateUIMessages({
        messages: allMessages,
      });
    } catch (error) {
      console.error('Message validation failed:', error);
      validatedMessages = allMessages;
    }

    let context = '';
    if (selectedDocumentId && messageText) {
      try {
        const document = await getDocument(selectedDocumentId);

        if (document) {
          const queryEmbedding = await generateEmbedding(messageText);

          const searchResults = await searchSimilarVectors(
            queryEmbedding,
            20,
            { documentId: { $eq: selectedDocumentId } }
          );

          console.log('\n=== PINECONE SEARCH RESULTS ===');
          console.log('Query:', messageText);
          console.log('Total results:', searchResults.length);
          console.log('Top 5 Pinecone results:');
          searchResults.slice(0, 5).forEach((result, index) => {
            console.log(`${index + 1}. Similarity: ${result.similarity.toFixed(4)} | Content: ${result.content?.substring(0, 100)}...`);
          });

          const rerankedResults = await rerankWithCohere(
            messageText,
            searchResults
          );

          console.log('\n=== COHERE RERANKED RESULTS ===');
          console.log('Total reranked results:', rerankedResults.length);
          console.log('Top 5 Cohere results:');
          rerankedResults.slice(0, 5).forEach((result, index) => {
            console.log(`${index + 1}. Relevance: ${result.similarity.toFixed(4)} | Content: ${result.content?.substring(0, 100)}...`);
          });
          console.log('=== END COMPARISON ===\n');

          const contextChunks = rerankedResults.slice(0, 10).map((result, index) =>
            `[Source ${index + 1}]: ${result.content || 'No content available'}`
          ).join('\n\n');

          context = `You have access to content from: ${document.title}\n\nContext:\n${contextChunks}`;
        }
      } catch (error) {
        console.error('RAG processing error:', error);
      }
    }

    const result = streamText({
      model: chatModel,
      system: `You are a helpful AI assistant that answers questions based on document context.

${context || 'No document context available.'}

IMPORTANT INSTRUCTIONS:
- Extract specific facts, numbers, and details from the context above
- If the context contains the answer, provide the exact information
- Quote specific amounts, percentages, and figures when available
- If the context doesn't contain the requested information, clearly state this
- Always base your answers on the provided context, not general knowledge`,
      messages: await convertToModelMessages(validatedMessages),
      temperature: 0.1,
    });

    result.consumeStream();

    console.log('About to return stream response with validatedMessages:', validatedMessages.length);
    console.log('Context:', context);

    return result.toUIMessageStreamResponse({
      originalMessages: validatedMessages,
      generateMessageId: createIdGenerator({
        prefix: 'msg',
        size: 16,
      }),
      onFinish: async ({ messages }) => {
        console.log('onFinish called with messages:', messages.length);
        console.log('All messages:', JSON.stringify(messages, null, 2));
        console.log('Last message role:', messages[messages.length - 1]?.role);
        console.log('Last message content:', messages[messages.length - 1]?.parts);

        try {
          await connectDB();

          const conversationId = selectedDocumentId;

          for (const message of messages) {
            const textContent = message.parts
              ?.filter((part: any) => part.type === 'text')
              ?.map((part: any) => part.text)
              ?.join('') || '';

            await saveMessage({
              id: message.id,
              conversationId,
              role: message.role as 'user' | 'assistant',
              content: textContent,
              createdAt: new Date(),
              documentId: selectedDocumentId,
              context: message.role === 'assistant' ? context.substring(0, 1000) : undefined,
            });
          }

          console.log('Messages saved successfully in onFinish');
        } catch (error) {
          console.error('Error saving messages in onFinish:', error);
        }
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
