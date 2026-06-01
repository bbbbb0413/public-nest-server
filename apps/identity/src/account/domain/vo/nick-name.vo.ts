import { ValueObject } from '@libs/shared-kernel';

export class NickName extends ValueObject<string> {
  protected validate(value: string): void {
    if (value === null || value === undefined) {
      throw new Error('닉네임은 null일 수 없습니다.');
    }
  }

  static of(value: string): NickName {
    return new NickName(value);
  }

  static empty(): NickName {
    return new NickName('');
  }
}
