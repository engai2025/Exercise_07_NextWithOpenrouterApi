import { NextRequest, NextResponse } from 'next/server';
import { getAllDocuments, getDocument, deleteDocument } from '@/lib/mongodb';
import { deleteDocumentVectors } from '@/lib/pinecone';

export async function GET() {
  try {
    const documents = await getAllDocuments();

    return NextResponse.json({
      success: true,
      documents: documents.map(doc => ({
        documentId: doc.documentId,
        title: doc.title,
        filename: doc.filename,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        uploadedAt: doc.uploadedAt,
        processedAt: doc.processedAt,
        status: doc.status,
        chunkCount: doc.chunkCount,
        vectorCount: doc.vectorCount,
        contentLength: doc.contentLength,
      }))
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    const document = await getDocument(documentId);
    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    await deleteDocumentVectors(documentId);
    await deleteDocument(documentId);

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
