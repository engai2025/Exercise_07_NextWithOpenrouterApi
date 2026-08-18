import { connectDB, getDocument, getMessages } from '@/lib/mongodb';
import { redirect } from 'next/navigation';
import ChatInterface from '@/components/chat-interface';
import { UIMessage } from 'ai';

interface PageProps {
  params: Promise<{ documentId: string }>;
}

async function loadChatHistory(documentId: string): Promise<UIMessage[]> {
  try {
    await connectDB();

    const messages = await getMessages(documentId);

    return messages.map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: msg.content }],
      createdAt: new Date(msg.createdAt),
    }));
  } catch (error) {
    console.error('Error loading chat history:', error);
    return [];
  }
}


export default async function ChatPage({ params }: PageProps) {
  const { documentId } = await params;

  console.log('Chat page - documentId:', documentId);

  const document = await getDocument(documentId);
  console.log('Chat page - document found:', !!document);

  if (!document) {
    console.log('Chat page - document not found, redirecting to home');
    redirect('/');
  }

  const initialMessages = await loadChatHistory(documentId);

  return (
    <ChatInterface
      selectedDocumentId={documentId}
      initialMessages={initialMessages}
      documentTitle={document.title}
    />
  );
}
