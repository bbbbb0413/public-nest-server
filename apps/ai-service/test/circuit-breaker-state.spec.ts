import { CircuitBreakerState } from '../src/llm-gateway/domain/model/circuit-breaker-state';

const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 60_000;

describe('CircuitBreakerState', () => {
  const now = Date.now();

  describe('create()', () => {
    it('초기 상태는 closed이고 failureCount는 0이다', () => {
      const state = CircuitBreakerState.create('claude-sonnet-4-6');
      expect(state.getStatus()).toBe('closed');
      expect(state.model).toBe('claude-sonnet-4-6');
    });
  });

  describe('restore()', () => {
    it('저장된 상태를 복원한다', () => {
      const state = CircuitBreakerState.restore({
        model: 'gpt-4o',
        status: 'open',
        failureCount: 5,
        openedAt: now,
      });
      expect(state.getStatus()).toBe('open');
      expect(state.model).toBe('gpt-4o');
    });
  });

  describe('canCall()', () => {
    it('closed 상태에서는 호출 가능하다', () => {
      const state = CircuitBreakerState.create('model-a');
      expect(state.canCall(now)).toBe(true);
    });

    it('open 상태에서는 호출 불가능하다', () => {
      const state = CircuitBreakerState.restore({
        model: 'model-a',
        status: 'open',
        failureCount: 5,
        openedAt: now,
      });
      expect(state.canCall(now)).toBe(false);
    });

    it('open 상태에서 60초 경과 후에는 half-open으로 전환되어 호출 가능하다', () => {
      const openedAt = now - RESET_TIMEOUT_MS - 1;
      const state = CircuitBreakerState.restore({
        model: 'model-a',
        status: 'open',
        failureCount: 5,
        openedAt,
      });
      expect(state.canCall(now)).toBe(true);
      expect(state.getStatus()).toBe('half-open');
    });

    it('half-open 상태에서는 호출 가능하다', () => {
      const state = CircuitBreakerState.restore({
        model: 'model-a',
        status: 'half-open',
        failureCount: 5,
        openedAt: now - RESET_TIMEOUT_MS - 1,
      });
      expect(state.canCall(now)).toBe(true);
    });
  });

  describe('recordFailure()', () => {
    it(`${FAILURE_THRESHOLD}회 실패 전에는 closed 상태를 유지한다`, () => {
      const state = CircuitBreakerState.create('model-a');
      for (let i = 0; i < FAILURE_THRESHOLD - 1; i++) {
        state.recordFailure(now);
      }
      expect(state.getStatus()).toBe('closed');
    });

    it(`${FAILURE_THRESHOLD}회 실패 시 open 상태로 전환된다`, () => {
      const state = CircuitBreakerState.create('model-a');
      for (let i = 0; i < FAILURE_THRESHOLD; i++) {
        state.recordFailure(now);
      }
      expect(state.getStatus()).toBe('open');
    });

    it('half-open 상태에서 실패하면 즉시 open으로 전환된다', () => {
      const state = CircuitBreakerState.restore({
        model: 'model-a',
        status: 'half-open',
        failureCount: 0,
        openedAt: null,
      });
      state.recordFailure(now);
      expect(state.getStatus()).toBe('open');
    });
  });

  describe('recordSuccess()', () => {
    it('성공 시 closed 상태로 전환되고 failureCount가 초기화된다', () => {
      const state = CircuitBreakerState.restore({
        model: 'model-a',
        status: 'half-open',
        failureCount: 3,
        openedAt: now,
      });
      state.recordSuccess();
      expect(state.getStatus()).toBe('closed');
    });
  });

  describe('snapshot()', () => {
    it('현재 상태를 직렬화하여 반환한다', () => {
      const state = CircuitBreakerState.restore({
        model: 'gpt-4o',
        status: 'open',
        failureCount: 5,
        openedAt: now,
      });
      const snap = state.snapshot();
      expect(snap.model).toBe('gpt-4o');
      expect(snap.status).toBe('open');
      expect(snap.failureCount).toBe(5);
      expect(snap.openedAt).toBe(now);
    });
  });
});
