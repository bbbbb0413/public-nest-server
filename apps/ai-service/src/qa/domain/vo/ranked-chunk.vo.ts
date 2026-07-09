import { ValueObject } from '@libs/shared-kernel';
import { SimilaritySearchResult } from '../../../knowledge/domain/port/vector-store.port';

export interface RankedChunkProps {
  text: string;
  score: number;
  rank: number;
  metadata: {
    documentId: string;
    fileName: string;
    chunkIndex: number;
  };
}

export class RankedChunk extends ValueObject<RankedChunkProps> {
  get text(): string {
    return this.getValue().text;
  }

  get score(): number {
    return this.getValue().score;
  }

  get rank(): number {
    return this.getValue().rank;
  }

  get metadata(): RankedChunkProps['metadata'] {
    return this.getValue().metadata;
  }

  protected validate(value: RankedChunkProps): void {
    if (!value.text) throw new Error('text는 비어있을 수 없습니다.');
    if (value.score < 0) throw new Error('score는 0 이상이어야 합니다.');
    if (value.rank < 1) throw new Error('rank는 1 이상이어야 합니다.');
  }

  static of(props: RankedChunkProps): RankedChunk {
    return new RankedChunk(props);
  }

  toSimilarityResult(): SimilaritySearchResult {
    return {
      text: this.text,
      score: this.score,
      metadata: { ...this.metadata },
    };
  }
}
