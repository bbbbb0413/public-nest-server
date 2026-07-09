import { ValueObject } from '@libs/shared-kernel';

export class ModelRoute extends ValueObject<string> {
  protected validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error('모델명은 빈 값일 수 없습니다.');
    }
  }

  static of(model: string): ModelRoute {
    return new ModelRoute(model);
  }
}
