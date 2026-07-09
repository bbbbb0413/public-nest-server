import { ValueObject } from '@libs/shared-kernel';

export class PromptName extends ValueObject<string> {
  protected validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error('프롬프트 이름은 비어있을 수 없습니다.');
    }
    if (!/^[a-z0-9-]+$/.test(value)) {
      throw new Error('프롬프트 이름은 소문자, 숫자, 하이픈만 허용됩니다.');
    }
  }

  static of(value: string): PromptName {
    return new PromptName(value);
  }
}
