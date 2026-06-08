export interface IEmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

export const EmbeddingProvider = Symbol('EmbeddingProvider');
