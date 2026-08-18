export async function rerankWithCohere(
    query: string,
    documents: any[]
  ): Promise<any[]> {
    const apiKey = process.env.COHERE_API_KEY;

    if (!apiKey) {
      console.warn('COHERE_API_KEY not found, using original results');
      return documents;
    }

    if (documents.length === 0) {
      return documents;
    }

    try {
      const documentTexts = documents.map(doc => doc.content || '');

      const response = await fetch('https://api.cohere.com/v2/rerank', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "rerank-v3.5",
          query: query,
          documents: documentTexts,
          max_tokens_per_doc: 4096
        })
      });

      if (!response.ok) {
        console.error('Cohere API error:', response.status);
        return documents;
      }

      const result = await response.json();

      const rerankedDocuments = [];

      for (const item of result.results) {
        const originalDoc = documents[item.index];
        if (originalDoc) {
          rerankedDocuments.push({
            ...originalDoc,
            similarity: item.relevance_score
          });
        }
      }

      console.log(`Cohere reranking: ${documents.length} → ${rerankedDocuments.length} documents`);
      return rerankedDocuments;

    } catch (error) {
      console.error('Reranking error:', error);
      return documents;
    }
  }
