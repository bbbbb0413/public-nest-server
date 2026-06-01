import { ValueObject } from '@libs/shared-kernel';

export class Uuid extends ValueObject<string> {
  protected validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error('UUID는 비어있을 수 없습니다.');
    }
  }

  static of(value: string): Uuid {
    return new Uuid(value);
  }
}
