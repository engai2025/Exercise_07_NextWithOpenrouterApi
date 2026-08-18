export interface DocumentSource {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  content: string;
  similarity: number;
}
