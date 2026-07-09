import { SimilaritySearchResult } from '../../../knowledge/domain/port/vector-store.port';

export interface IRerankerPort {
  rerank(
    query: string,
    chunks: SimilaritySearchResult[],
    topN: number,
  ): Promise<SimilaritySearchResult[]>;
}

export const RerankerPort = Symbol('RerankerPort');
