import { TokenUsage } from '../src/llm-gateway/domain/vo/token-usage.vo';
import { ModelRoute } from '../src/llm-gateway/domain/vo/model-route.vo';

describe('TokenUsage', () => {
  describe('of()', () => {
    it('유효한 토큰 값으로 생성된다', () => {
      const usage = TokenUsage.of(100, 200);
      expect(usage.promptTokens).toBe(100);
      expect(usage.completionTokens).toBe(200);
    });

    it('total()은 prompt + completion을 반환한다', () => {
      const usage = TokenUsage.of(100, 200);
      expect(usage.total()).toBe(300);
    });

    it('0으로 생성할 수 있다', () => {
      const usage = TokenUsage.of(0, 0);
      expect(usage.total()).toBe(0);
    });

    it('음수 promptTokens는 오류를 던진다', () => {
      expect(() => TokenUsage.of(-1, 0)).toThrow();
    });

    it('음수 completionTokens는 오류를 던진다', () => {
      expect(() => TokenUsage.of(0, -1)).toThrow();
    });

    it('정수가 아닌 값은 오류를 던진다', () => {
      expect(() => TokenUsage.of(1.5, 0)).toThrow();
      expect(() => TokenUsage.of(0, 2.7)).toThrow();
    });
  });

  describe('equals()', () => {
    it('같은 값이면 true를 반환한다', () => {
      const a = TokenUsage.of(100, 200);
      const b = TokenUsage.of(100, 200);
      expect(a.equals(b)).toBe(true);
    });

    it('다른 값이면 false를 반환한다', () => {
      const a = TokenUsage.of(100, 200);
      const b = TokenUsage.of(100, 300);
      expect(a.equals(b)).toBe(false);
    });
  });
});

describe('ModelRoute', () => {
  describe('of()', () => {
    it('유효한 모델명으로 생성된다', () => {
      const route = ModelRoute.of('claude-sonnet-4-6');
      expect(route.getValue()).toBe('claude-sonnet-4-6');
    });

    it('빈 문자열은 오류를 던진다', () => {
      expect(() => ModelRoute.of('')).toThrow();
    });

    it('공백만 있는 문자열은 오류를 던진다', () => {
      expect(() => ModelRoute.of('   ')).toThrow();
    });
  });
});
