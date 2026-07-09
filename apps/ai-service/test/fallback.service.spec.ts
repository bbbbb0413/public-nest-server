import { ILlmProvider, LlmProvider } from '@libs/llm';
import { Test } from '@nestjs/testing';
import { FallbackService } from '../src/llm-gateway/application/fallback.service';
import { CircuitBreakerPort, ICircuitBreakerPort } from '../src/llm-gateway/domain/port/circuit-breaker.port';

async function collectAsyncIterable(iter: AsyncIterable<{ token?: string; model: string }>): Promise<Array<{ token?: string; model: string }>> {
  const results: Array<{ token?: string; model: string }> = [];
  for await (const item of iter) {
    results.push(item);
  }
  return results;
}

describe('FallbackService', () => {
  let service: FallbackService;
  let mockLlm: jest.Mocked<ILlmProvider>;
  let mockBreaker: jest.Mocked<ICircuitBreakerPort>;

  beforeEach(async () => {
    mockLlm = {
      chat: jest.fn(),
      stream: jest.fn(),
    } as jest.Mocked<ILlmProvider>;

    mockBreaker = {
      canCall: jest.fn(),
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
      getState: jest.fn(),
    } as jest.Mocked<ICircuitBreakerPort>;

    const module = await Test.createTestingModule({
      providers: [
        FallbackService,
        { provide: LlmProvider, useValue: mockLlm },
        { provide: CircuitBreakerPort, useValue: mockBreaker },
      ],
    }).compile();

    service = module.get(FallbackService);
  });

  describe('streamWithFallback()', () => {
    const messages = [{ role: 'user' as const, content: '질문' }];
    const chain = ['claude-sonnet-4-6', 'gpt-4o', 'gemini-2.0-flash'] as const;

    it('첫 번째 모델이 성공하면 해당 모델로 토큰을 스트리밍한다', async () => {
      mockBreaker.canCall.mockResolvedValue(true);
      mockBreaker.recordSuccess.mockResolvedValue(undefined);

      async function* tokens() {
        yield 'hello';
        yield ' world';
      }
      mockLlm.stream.mockReturnValue(tokens());

      const results = await collectAsyncIterable(
        service.streamWithFallback(messages, chain),
      );

      expect(results).toEqual([
        { token: 'hello', model: 'claude-sonnet-4-6' },
        { token: ' world', model: 'claude-sonnet-4-6' },
      ]);
      expect(mockBreaker.recordSuccess).toHaveBeenCalledWith('claude-sonnet-4-6');
    });

    it('회로 개방된 모델은 건너뛰고 다음 모델로 폴백한다', async () => {
      mockBreaker.canCall.mockImplementation(async (model) =>
        model !== 'claude-sonnet-4-6',
      );
      mockBreaker.recordSuccess.mockResolvedValue(undefined);

      async function* tokens() {
        yield 'fallback';
      }
      mockLlm.stream.mockReturnValue(tokens());

      const results = await collectAsyncIterable(
        service.streamWithFallback(messages, chain),
      );

      expect(results[0].model).toBe('gpt-4o');
      expect(mockLlm.stream).toHaveBeenCalledWith(
        messages,
        expect.objectContaining({ model: 'gpt-4o' }),
      );
    });

    it('첫 번째 모델 실패 시 두 번째 모델로 폴백한다', async () => {
      mockBreaker.canCall.mockResolvedValue(true);
      mockBreaker.recordFailure.mockResolvedValue(undefined);
      mockBreaker.recordSuccess.mockResolvedValue(undefined);

      async function* failTokens() {
        throw new Error('API Error');
        yield 'unreachable';
      }

      async function* successTokens() {
        yield 'fallback ok';
      }

      mockLlm.stream
        .mockReturnValueOnce(failTokens())
        .mockReturnValueOnce(successTokens());

      const results = await collectAsyncIterable(
        service.streamWithFallback(messages, chain),
      );

      expect(results).toEqual([{ token: 'fallback ok', model: 'gpt-4o' }]);
      expect(mockBreaker.recordFailure).toHaveBeenCalledWith('claude-sonnet-4-6');
      expect(mockBreaker.recordSuccess).toHaveBeenCalledWith('gpt-4o');
    });

    it('모든 모델 실패 시 시도 목록을 포함한 오류를 던진다', async () => {
      mockBreaker.canCall.mockResolvedValue(true);
      mockBreaker.recordFailure.mockResolvedValue(undefined);

      async function* failTokens() {
        throw new Error('API Error');
        yield 'unreachable';
      }

      mockLlm.stream
        .mockReturnValueOnce(failTokens())
        .mockReturnValueOnce(failTokens())
        .mockReturnValueOnce(failTokens());

      await expect(
        collectAsyncIterable(service.streamWithFallback(messages, chain)),
      ).rejects.toThrow('claude-sonnet-4-6');
    });

    it('모든 모델이 회로 개방 상태이면 오류를 던진다', async () => {
      mockBreaker.canCall.mockResolvedValue(false);

      await expect(
        collectAsyncIterable(service.streamWithFallback(messages, chain)),
      ).rejects.toThrow();
    });
  });
});
