export interface SemanticCacheHit {
  answer: string;
  score: number;
}

export interface ISemanticCachePort {
  findSimilar(
    embedding: number[],
    threshold: number,
    tenant: string,
  ): Promise<SemanticCacheHit | null>;
  store(
    embedding: number[],
    question: string,
    answer: string,
    ttlSeconds: number,
    tenant: string,
  ): Promise<void>;
}

export const SemanticCachePort = Symbol('SemanticCachePort');
