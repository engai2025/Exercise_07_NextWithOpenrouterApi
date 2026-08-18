export async function processDocument(
    file: File
): Promise<{ content: string; chunks: string[] }> {
    const fileType = file.name.split('.').pop()?.toLowerCase();

    let content = '';

    switch (fileType) {
        case 'pdf':
            console.log('Processing PDF file:', file.name);
            content = await processPDF(file);
            break;
        case 'docx':
            console.log('Processing DOCX file:', file.name);
            content = await processDOCX(file);
            break;
        case 'txt':
        case 'md':
            console.log('Processing text file:', file.name);
            content = await processText(file);
            break;
        default:
            throw new Error(`Unsupported file type: ${fileType}`);
    }

    const chunks = await createChunks(content, file.name);

    return { content, chunks };
}

async function processPDF(file: File): Promise<string> {
    try {
        console.log('Processing PDF:', file.name, 'Size:', file.size);

        const { configurePdfWorker, PDFParse } = await import('@/lib/pdf');
        configurePdfWorker();

        const buffer = Buffer.from(await file.arrayBuffer());
        const parser = new PDFParse({ data: buffer });

        try {
            const result = await parser.getText();

            if (!result.text?.trim()) {
                return `No text content could be extracted from ${file.name}. The PDF might be image-based or encrypted.`;
            }

            console.log('PDF processing complete. Text length:', result.text.length);
            return result.text.trim();
        } finally {
            await parser.destroy();
        }

    } catch (error) {
        console.error('PDF processing error:', error);

        if (error instanceof Error) {
            if (error.message.includes('Invalid PDF') || error.message.includes('PDF')) {
                throw new Error(`The uploaded file is not a valid PDF or is corrupted.`);
            } else if (error.message.includes('password')) {
                throw new Error(`The PDF is password protected. Please upload an unprotected PDF.`);
            } else {
                throw new Error(`PDF processing failed: ${error.message}`);
            }
        }

        throw new Error(`PDF processing failed: Unknown error occurred`);
    }
}

async function processDOCX(file: File): Promise<string> {
    try {
        console.log('Processing DOCX:', file.name, 'Size:', file.size);

        const mammoth = await import('mammoth');
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await mammoth.extractRawText({ buffer });
        const fullText = result.value;

        if (!fullText.trim()) {
            throw new Error('No text content could be extracted from the DOCX file.');
        }

        console.log('DOCX processing complete. Text length:', fullText.length);
        return fullText.trim();

    } catch (error) {
        console.error('DOCX processing error:', error);
        if (error instanceof Error) {
            throw new Error(`DOCX processing failed: ${error.message}`);
        }
        throw new Error('DOCX processing failed: Unknown error occurred');
    }
}

async function processText(file: File): Promise<string> {
    return await file.text();
}

async function createChunks(content: string, filename: string): Promise<string[]> {
    let cleanContent = content.trim().replace(/  +/g, ' ');

    const { RecursiveCharacterTextSplitter } = await import('@langchain/textsplitters');
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 2000,
        chunkOverlap: 400,
        separators: [
            '\n\n\n',
            '\n\n',
            '\n',
            '. ',
            ' ',
            ''
        ],
    });

    const rawChunks = await splitter.splitText(cleanContent);
    return rawChunks.map(chunk => addContext(chunk, filename));
}

function addContext(chunk: string, filename: string): string {
    const docName = filename.replace(/\.[^/.]+$/, '');
    return `Document: ${docName}\n\n${chunk}`;
}

export const SUPPORTED_FILE_TYPES = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'text/plain': 'txt',
    'text/markdown': 'md',
} as const;

export function isFileTypeSupported(file: File): boolean {
    return file.type in SUPPORTED_FILE_TYPES ||
        ['pdf', 'docx', 'txt', 'md'].includes(
            file.name.split('.').pop()?.toLowerCase() || ''
        );
}
