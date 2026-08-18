'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Download,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface Document {
  documentId: string;
  title: string;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  processedAt?: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  chunkCount?: number;
  vectorCount?: number;
  contentLength?: number;
}

interface DocumentListProps {
  documents: Document[];
  onDocumentDeleted: (documentId: string) => void;
}

export function DocumentList({ documents, onDocumentDeleted }: DocumentListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (documentId: string) => {
    if (deletingId) return;

    setDeletingId(documentId);

    try {
      const response = await fetch(`/api/documents?documentId=${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      onDocumentDeleted(documentId);
      toast.success('Document deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const getStatusIcon = (status: Document['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: Document['status']) => {
    const variants = {
      completed: 'default' as const,
      processing: 'secondary' as const,
      error: 'destructive' as const,
      uploading: 'outline' as const,
    };

    return (
      <Badge variant={variants[status]} className="text-xs">
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (documents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Document Library</span>
            <Badge variant="secondary">0</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No documents uploaded yet</p>
            <p className="text-sm">Upload a document to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Document Library</span>
          <Badge variant="secondary">{documents.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {documents.map((doc) => (
            <div 
              key={doc.documentId} 
              className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex-shrink-0 p-2 bg-gray-100 rounded-lg">
                <FileText className="w-5 h-5 text-gray-600" />
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm truncate">{doc.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">{doc.filename}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getStatusIcon(doc.status)}
                    {getStatusBadge(doc.status)}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{doc.fileType?.toUpperCase()}</span>
                  <span>{formatFileSize(doc.fileSize)}</span>
                  <span>{formatDate(doc.uploadedAt)}</span>
                </div>

                {doc.status === 'completed' && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {doc.chunkCount && <span>{doc.chunkCount} chunks</span>}
                    {doc.vectorCount && <span>{doc.vectorCount} vectors</span>}
                    {doc.contentLength && <span>{doc.contentLength.toLocaleString()} chars</span>}
                  </div>
                )}

                {doc.processedAt && (
                  <div className="text-xs text-muted-foreground">
                    Processed: {formatDate(doc.processedAt)}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {doc.status === 'completed' && (
                  <Link href={`/chat/${doc.documentId}`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      title="Chat with document"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </Link>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(doc.documentId)}
                  disabled={deletingId === doc.documentId}
                  className="text-muted-foreground hover:text-destructive"
                >
                  {deletingId === doc.documentId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}