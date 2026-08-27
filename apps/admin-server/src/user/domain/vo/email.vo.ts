import { ValueObject } from '@libs/shared-kernel';

export class Email extends ValueObject<string> {
  protected validate(value: string): void {
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new Error(`유효하지 않은 이메일 형식입니다: ${value}`);
    }
  }

  static of(value: string): Email {
    return new Email(value);
  }
}
