import { Injectable } from '@nestjs/common';
import { SimilaritySearchResult } from '../../knowledge/domain/port/vector-store.port';

const DEFAULT_K = 60;

@Injectable()
export class RrfFusionService {
  fuse(
    resultLists: SimilaritySearchResult[][],
    k: number = DEFAULT_K,
  ): SimilaritySearchResult[] {
    const scoreMap = new Map<
      string,
      { score: number; doc: SimilaritySearchResult }
    >();

    for (const list of resultLists) {
      list.forEach((doc, index) => {
        const key = `${doc.metadata.documentId}:${doc.metadata.chunkIndex}`;
        const rrfScore = 1 / (k + index + 1);
        const existing = scoreMap.get(key);
        if (existing) {
          scoreMap.set(key, { score: existing.score + rrfScore, doc });
        } else {
          scoreMap.set(key, { score: rrfScore, doc });
        }
      });
    }

    return [...scoreMap.values()]
      .sort((a, b) => b.score - a.score)
      .map(({ score, doc }) => ({ ...doc, score }));
  }
}
