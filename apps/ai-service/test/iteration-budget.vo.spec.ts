import { IterationBudget } from '../src/qa/domain/vo/iteration-budget.vo';

describe('IterationBudget VO', () => {
  describe('생성 유효성 검증', () => {
    it('maxIterations가 0이면 예외를 던진다', () => {
      expect(() => IterationBudget.of(0, 10000, 30000)).toThrow(
        'maxIterations는 1 이상 10 이하여야 합니다.',
      );
    });

    it('maxIterations가 11이면 예외를 던진다', () => {
      expect(() => IterationBudget.of(11, 10000, 30000)).toThrow(
        'maxIterations는 1 이상 10 이하여야 합니다.',
      );
    });

    it('tokenBudget이 0이면 예외를 던진다', () => {
      expect(() => IterationBudget.of(3, 0, 30000)).toThrow(
        'tokenBudget은 양수여야 합니다.',
      );
    });

    it('tokenBudget이 음수이면 예외를 던진다', () => {
      expect(() => IterationBudget.of(3, -1, 30000)).toThrow(
        'tokenBudget은 양수여야 합니다.',
      );
    });

    it('timeoutMs가 0이면 예외를 던진다', () => {
      expect(() => IterationBudget.of(3, 10000, 0)).toThrow(
        'timeoutMs는 양수여야 합니다.',
      );
    });

    it('유효한 값으로 생성된다', () => {
      const budget = IterationBudget.of(5, 30000, 45000);

      expect(budget.getMaxIterations()).toBe(5);
      expect(budget.getTokenBudget()).toBe(30000);
      expect(budget.getTimeoutMs()).toBe(45000);
    });

    it('maxIterations 경계값 1은 유효하다', () => {
      expect(() => IterationBudget.of(1, 1000, 1000)).not.toThrow();
    });

    it('maxIterations 경계값 10은 유효하다', () => {
      expect(() => IterationBudget.of(10, 1000, 1000)).not.toThrow();
    });
  });

  describe('isExhausted', () => {
    let budget: IterationBudget;

    beforeEach(() => {
      budget = IterationBudget.of(3, 10000, 30000);
    });

    it('완료 반복 횟수가 maxIterations에 도달하면 소진 상태', () => {
      expect(budget.isExhausted(3, 0, 0)).toBe(true);
    });

    it('완료 반복 횟수가 maxIterations 미만이면 미소진', () => {
      expect(budget.isExhausted(2, 0, 0)).toBe(false);
    });

    it('사용 토큰이 tokenBudget에 도달하면 소진 상태', () => {
      expect(budget.isExhausted(0, 10000, 0)).toBe(true);
    });

    it('사용 토큰이 tokenBudget 미만이면 미소진', () => {
      expect(budget.isExhausted(0, 9999, 0)).toBe(false);
    });

    it('경과 시간이 timeoutMs에 도달하면 소진 상태', () => {
      expect(budget.isExhausted(0, 0, 30000)).toBe(true);
    });

    it('경과 시간이 timeoutMs 미만이면 미소진', () => {
      expect(budget.isExhausted(0, 0, 29999)).toBe(false);
    });

    it('세 조건이 모두 미달이면 미소진', () => {
      expect(budget.isExhausted(2, 9999, 29999)).toBe(false);
    });
  });
});
