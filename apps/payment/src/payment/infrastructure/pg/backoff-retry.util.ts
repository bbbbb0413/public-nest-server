export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * fn()이 성공할 때까지 최대 maxAttempts번, 시도마다 baseDelayMs * 2^(n-1) 만큼 쉬며 재시도한다.
 * 마지막 시도까지 실패하면 마지막 에러를 그대로 던진다.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === options.maxAttempts) {
        break;
      }
      await sleep(options.baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}
