import { SimilaritySearchResult } from '../../../knowledge/domain/port/vector-store.port';

export interface ILexicalSearchPort {
  search(query: string, topK: number): Promise<SimilaritySearchResult[]>;
}

export const LexicalSearchPort = Symbol('LexicalSearchPort');
