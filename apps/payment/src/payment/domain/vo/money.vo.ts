import { ValueObject } from '@libs/shared-kernel';

interface MoneyProps {
  amount: number;
  currency: string;
}

export class Money extends ValueObject<MoneyProps> {
  protected validate(value: MoneyProps): void {
    if (value.amount < 0) {
      throw new Error('금액은 0 이상이어야 합니다.');
    }
    if (!value.currency || value.currency.trim().length === 0) {
      throw new Error('통화 코드는 필수입니다.');
    }
  }

  static of(amount: number, currency: string): Money {
    return new Money({ amount, currency });
  }

  getAmount(): number {
    return this.value.amount;
  }

  getCurrency(): string {
    return this.value.currency;
  }
}
