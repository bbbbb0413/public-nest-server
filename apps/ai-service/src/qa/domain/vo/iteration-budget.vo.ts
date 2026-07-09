import { ValueObject } from '@libs/shared-kernel';

interface IterationBudgetProps {
  maxIterations: number;
  tokenBudget: number;
  timeoutMs: number;
}

export class IterationBudget extends ValueObject<IterationBudgetProps> {
  protected validate(value: IterationBudgetProps): void {
    if (value.maxIterations < 1 || value.maxIterations > 10) {
      throw new Error('maxIterations는 1 이상 10 이하여야 합니다.');
    }
    if (value.tokenBudget <= 0) {
      throw new Error('tokenBudget은 양수여야 합니다.');
    }
    if (value.timeoutMs <= 0) {
      throw new Error('timeoutMs는 양수여야 합니다.');
    }
  }

  isExhausted(
    iterationsCompleted: number,
    tokensUsed: number,
    elapsedMs: number,
  ): boolean {
    return (
      iterationsCompleted >= this.value.maxIterations ||
      tokensUsed >= this.value.tokenBudget ||
      elapsedMs >= this.value.timeoutMs
    );
  }

  getMaxIterations(): number {
    return this.value.maxIterations;
  }

  getTokenBudget(): number {
    return this.value.tokenBudget;
  }

  getTimeoutMs(): number {
    return this.value.timeoutMs;
  }

  static of(
    maxIterations: number,
    tokenBudget: number,
    timeoutMs: number,
  ): IterationBudget {
    return new IterationBudget({ maxIterations, tokenBudget, timeoutMs });
  }
}
