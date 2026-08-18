'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, ArrowLeft, AlertCircle, RotateCcw } from 'lucide-react';
import { UIMessage } from 'ai';
import Link from 'next/link';
import { toast } from 'sonner';

interface ChatInterfaceProps {
  selectedDocumentId: string;
  initialMessages: UIMessage[];
  documentTitle: string;
}

export default function ChatInterface({ 
  selectedDocumentId, 
  initialMessages, 
  documentTitle 
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error, stop } = useChat({
    id: selectedDocumentId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest({ messages }) {
        return { 
          body: { 
            message: messages[messages.length - 1],
            selectedDocumentId: selectedDocumentId,
          } 
        };
      },
    }),
    onError: (error) => {
      console.error('Chat error:', error);
      toast.error('Failed to send message');
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && status === 'ready') {
      sendMessage({ text: input });
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="bg-white border-b border-blue-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-blue-500 text-white font-medium">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {documentTitle}
              </h1>
              <p className="text-sm text-blue-500">Chat with AI Assistant</p>
            </div>
          </div>
          <Link href="/">
            <Button 
              variant="outline" 
              className="border-blue-200 text-blue-600 hover:bg-blue-50"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
                <Bot className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Start a conversation
              </h3>
              <p className="text-gray-500">
                Ask me anything about your document! I'm here to help.
              </p>
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start space-x-3 max-w-2xl ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                {!(message.role === 'assistant' && (status === 'submitted' || status === 'streaming')) && (
                  <Avatar className="h-7 w-7 flex-shrink-0">
                    {message.role === 'user' ? (
                      <AvatarFallback className="bg-blue-500 text-white text-xs">
                        <User className="h-3 w-3" />
                      </AvatarFallback>
                    ) : (
                      <AvatarFallback className="bg-blue-100">
                        <Bot className="h-3 w-3 text-blue-500" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                )}
                
                {message.role === 'assistant' && (status === 'submitted' || status === 'streaming') && (
                  <div className="w-7 h-7 flex-shrink-0"></div>
                )}
                
                <div className={`rounded-2xl px-4 py-3 ${
                  message.role === 'user' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-50 text-gray-900 border border-gray-100'
                }`}>
                  <div className="text-sm leading-relaxed">
                    {message.parts.map((part, i) => {
                      switch (part.type) {
                        case 'text':
                          return (
                            <span
                              key={i}
                              className={`whitespace-pre-wrap ${message.role === 'assistant' ? 'block' : ''}`}
                            >
                              {part.text}
                            </span>
                          );
                        default:
                          return null;
                      }
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {(status === 'submitted' || status === 'streaming') && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-3 max-w-2xl">
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarFallback className="bg-blue-100">
                    <Bot className="h-3 w-3 text-blue-500" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex items-center space-x-2">
                    {status === 'submitted' && (
                      <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    )}
                    <span className="text-gray-500 text-sm">
                      {status === 'submitted' ? 'AI is thinking...' : 'AI is responding...'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => stop()}
                      className="ml-2 h-5 px-2 text-xs text-blue-500 hover:bg-blue-50"
                    >
                      Stop
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-3 max-w-2xl">
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarFallback className="bg-red-100">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-800 font-medium text-sm">Something went wrong</p>
                      <p className="text-red-600 text-xs">Please try again</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.reload()}
                      className="ml-2 h-6 px-2 text-xs border-red-200 text-red-600 hover:bg-red-100"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Retry
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="bg-white border-t border-blue-100 p-6">
        <form
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto"
        >
          <div className="flex space-x-3">
            <input
              className="flex-1 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              value={input}
              placeholder="Type your message..."
              onChange={(e) => setInput(e.target.value)}
              disabled={status !== 'ready'}
            />
            <Button 
              type="submit" 
              disabled={status !== 'ready' || !input.trim()}
              className="px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}