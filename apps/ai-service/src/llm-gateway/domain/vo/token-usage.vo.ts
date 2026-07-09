import { ValueObject } from '@libs/shared-kernel';

interface TokenUsageProps {
  promptTokens: number;
  completionTokens: number;
}

export class TokenUsage extends ValueObject<TokenUsageProps> {
  protected validate(value: TokenUsageProps): void {
    if (!Number.isInteger(value.promptTokens) || value.promptTokens < 0) {
      throw new Error('promptTokens는 0 이상의 정수여야 합니다.');
    }
    if (
      !Number.isInteger(value.completionTokens) ||
      value.completionTokens < 0
    ) {
      throw new Error('completionTokens는 0 이상의 정수여야 합니다.');
    }
  }

  static of(promptTokens: number, completionTokens: number): TokenUsage {
    return new TokenUsage({ promptTokens, completionTokens });
  }

  get promptTokens(): number {
    return this.value.promptTokens;
  }

  get completionTokens(): number {
    return this.value.completionTokens;
  }

  total(): number {
    return this.value.promptTokens + this.value.completionTokens;
  }
}
