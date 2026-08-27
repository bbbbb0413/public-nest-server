import { retryWithBackoff } from './backoff-retry.util';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('첫 시도에 성공하면 재시도 없이 결과를 반환한다', async () => {
    const fn = jest.fn().mockResolvedValue('ok');

    const result = await retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 100 });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('중간에 실패해도 maxAttempts 안에서 성공하면 그 결과를 반환한다', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('일시적 실패'))
      .mockResolvedValueOnce('recovered');

    const promise = retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 100 });
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('매 시도마다 지수적으로 대기 시간이 늘어난다', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockResolvedValueOnce('ok');
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const promise = retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 100 });
    await jest.runAllTimersAsync();
    await promise;

    const delays = setTimeoutSpy.mock.calls.map((call) => call[1]);
    expect(delays).toEqual([100, 200]);
  });

  it('maxAttempts를 모두 소진하면 마지막 에러를 던진다', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('영구 실패'));

    const promise = retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 100 });
    const assertion = expect(promise).rejects.toThrow('영구 실패');
    await jest.runAllTimersAsync();
    await assertion;

    expect(fn).toHaveBeenCalledTimes(3);
  });
});
