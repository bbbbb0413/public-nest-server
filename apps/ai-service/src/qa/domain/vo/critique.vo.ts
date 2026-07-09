import { ValueObject } from '@libs/shared-kernel';

interface CritiqueProps {
  answered: boolean;
  missing: string[];
  nextQuery: string;
  confidence: number;
}

export class Critique extends ValueObject<CritiqueProps> {
  protected validate(value: CritiqueProps): void {
    if (value.confidence < 0 || value.confidence > 1) {
      throw new Error('confidence는 0 이상 1 이하여야 합니다.');
    }
  }

  isSatisfied(threshold: number): boolean {
    return this.value.answered && this.value.confidence >= threshold;
  }

  getNextQuery(): string {
    return this.value.nextQuery;
  }

  getConfidence(): number {
    return this.value.confidence;
  }

  getMissing(): string[] {
    return [...this.value.missing];
  }

  static of(
    answered: boolean,
    missing: string[],
    nextQuery: string,
    confidence: number,
  ): Critique {
    return new Critique({ answered, missing, nextQuery, confidence });
  }
}
