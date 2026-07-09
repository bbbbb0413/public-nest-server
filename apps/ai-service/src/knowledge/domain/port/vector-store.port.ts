export interface VectorDocument {
  id: string;
  text: string;
  embedding: number[];
  metadata: {
    documentId: string;
    fileName: string;
    chunkIndex: number;
    charCount?: number;
    parentText?: string;
    parentChunkId?: string;
  };
}

export interface SimilaritySearchResult {
  text: string;
  score: number;
  metadata: VectorDocument['metadata'];
}

export interface IVectorStorePort {
  upsert(documents: VectorDocument[]): Promise<void>;
  similaritySearch(
    queryEmbedding: number[],
    topK: number,
  ): Promise<SimilaritySearchResult[]>;
  findByParentChunkIds(
    parentChunkIds: string[],
  ): Promise<SimilaritySearchResult[]>;
  findChunksByDocumentId(documentId: string): Promise<SimilaritySearchResult[]>;
  deleteByDocumentId(documentId: string): Promise<void>;
}

export const VectorStorePort = Symbol('VectorStorePort');
