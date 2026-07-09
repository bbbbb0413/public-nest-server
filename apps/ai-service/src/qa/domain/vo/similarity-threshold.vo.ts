import { ValueObject } from '@libs/shared-kernel';

export class SimilarityThreshold extends ValueObject<number> {
  protected validate(value: number): void {
    if (value < 0 || value > 1) {
      throw new Error('유사도 임계값은 0과 1 사이여야 합니다.');
    }
  }

  static of(value: number): SimilarityThreshold {
    return new SimilarityThreshold(value);
  }
}
