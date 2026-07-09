import { randomUUID } from 'crypto';
import { ValueObject } from '@libs/shared-kernel';

export class SessionId extends ValueObject<string> {
  protected validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error('SessionId는 비어있을 수 없습니다.');
    }
  }

  static generate(): SessionId {
    return new SessionId(randomUUID());
  }

  static of(value: string): SessionId {
    return new SessionId(value);
  }
}
