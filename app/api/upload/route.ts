import { NextRequest, NextResponse } from 'next/server';
import { processDocument, isFileTypeSupported } from '@/lib/document-processor';
import { generateEmbeddings } from '@/lib/ai/embeddings';
import { storeVectors } from '@/lib/pinecone';
import { createDocument, updateDocument } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  let documentId: string | undefined;

  try {
    if (!process.env.PINECONE_API_KEY) {
      return NextResponse.json(
        { error: 'PINECONE_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!isFileTypeSupported(file)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload PDF, DOCX, TXT, or MD files.' },
        { status: 400 }
      );
    }

    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 100MB.' },
        { status: 400 }
      );
    }

    documentId = `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    await createDocument({
      documentId,
      title: file.name.replace(/\.[^/.]+$/, ''),
      filename: file.name,
      fileType: file.name.split('.').pop()?.toLowerCase() || 'unknown',
      fileSize: file.size,
      uploadedAt: new Date(),
      status: 'processing',
    });

    const { content, chunks } = await processDocument(file);

    if (chunks.length === 0) {
      await updateDocument(documentId, {
        status: 'error',
        errorMessage: 'No content could be extracted from the file.'
      });

      return NextResponse.json(
        { error: 'No content could be extracted from the file.' },
        { status: 400 }
      );
    }

    const embeddings = await generateEmbeddings(chunks);

    const vectorCount = await storeVectors(
      documentId,
      embeddings,
      {
        title: file.name.replace(/\.[^/.]+$/, ''),
        filename: file.name,
        fileType: file.name.split('.').pop()?.toLowerCase() || 'unknown',
      }
    );

    await updateDocument(documentId, {
      status: 'completed',
      processedAt: new Date(),
      chunkCount: chunks.length,
      vectorCount,
      contentLength: content.length,
    });

    return NextResponse.json({
      success: true,
      documentId,
      filename: file.name,
      message: `Successfully processed ${chunks.length} chunks and stored ${vectorCount} vectors.`,
      stats: {
        originalSize: file.size,
        chunkCount: chunks.length,
        vectorCount,
        contentLength: content.length,
      },
    });

  } catch (error) {
    console.error('Upload processing error:', error);

    const details = error instanceof Error ? error.message : 'Unknown error';

    if (documentId) {
      try {
        await updateDocument(documentId, {
          status: 'error',
          errorMessage: details,
        });
      } catch (updateError) {
        console.error('Failed to mark document as error:', updateError);
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to process document',
        details,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to upload files.' },
    { status: 405 }
  );
}
