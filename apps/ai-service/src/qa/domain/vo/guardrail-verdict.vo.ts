import { ValueObject } from '@libs/shared-kernel';

interface VerdictProps {
  allowed: boolean;
  reason: string;
  matchedPattern?: string;
}

export class GuardrailVerdict extends ValueObject<VerdictProps> {
  protected validate(value: VerdictProps): void {
    if (!value.allowed && !value.reason) {
      throw new Error('차단 판정에는 사유가 필요합니다.');
    }
  }

  static allow(): GuardrailVerdict {
    return new GuardrailVerdict({ allowed: true, reason: 'ok' });
  }

  static block(reason: string, pattern?: string): GuardrailVerdict {
    return new GuardrailVerdict({
      allowed: false,
      reason,
      matchedPattern: pattern,
    });
  }

  isAllowed(): boolean {
    return this.value.allowed;
  }

  getReason(): string {
    return this.value.reason;
  }
}
