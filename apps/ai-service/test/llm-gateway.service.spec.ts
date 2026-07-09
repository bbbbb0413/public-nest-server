import { Test } from '@nestjs/testing';
import { LlmGatewayService } from '../src/llm-gateway/application/llm-gateway.service';
import { FallbackService } from '../src/llm-gateway/application/fallback.service';
import { CostTrackingService } from '../src/llm-gateway/application/cost-tracking.service';
import { LlmRoutingService } from '../src/llm-gateway/application/llm-routing.service';
import { GatewayCallCommand } from '../src/llm-gateway/application/command/gateway-call.command';
import { LlmMessage } from '@libs/llm';

async function collect(iter: AsyncIterable<string>): Promise<string[]> {
  const tokens: string[] = [];
  for await (const t of iter) tokens.push(t);
  return tokens;
}

describe('LlmGatewayService', () => {
  let service: LlmGatewayService;
  let mockFallback: jest.Mocked<FallbackService>;
  let mockCostTracking: jest.Mocked<CostTrackingService>;
  let mockRouting: jest.Mocked<LlmRoutingService>;

  const messages: LlmMessage[] = [{ role: 'user', content: '질문' }];

  beforeEach(async () => {
    mockFallback = {
      streamWithFallback: jest.fn(),
    } as unknown as jest.Mocked<FallbackService>;

    mockCostTracking = {
      track: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CostTrackingService>;

    mockRouting = {
      resolveChain: jest.fn().mockReturnValue(['claude-sonnet-4-6', 'gpt-4o']),
    } as unknown as jest.Mocked<LlmRoutingService>;

    const module = await Test.createTestingModule({
      providers: [
        LlmGatewayService,
        { provide: FallbackService, useValue: mockFallback },
        { provide: CostTrackingService, useValue: mockCostTracking },
        { provide: LlmRoutingService, useValue: mockRouting },
      ],
    }).compile();

    service = module.get(LlmGatewayService);
  });

  describe('stream()', () => {
    it('라우팅 체인을 통해 토큰을 스트리밍하고 비용을 추적한다', async () => {
      async function* mockStream() {
        yield { token: 'hello', model: 'claude-sonnet-4-6' };
        yield { token: ' world', model: 'claude-sonnet-4-6' };
      }
      mockFallback.streamWithFallback.mockReturnValue(mockStream());

      const command = new GatewayCallCommand(messages, 'rag-qa', 'default');
      const tokens = await collect(service.stream(command));

      expect(tokens).toEqual(['hello', ' world']);
      expect(mockCostTracking.track).toHaveBeenCalledTimes(1);
    });

    it('폴백 사용 시 비용 추적에 fallbackUsed가 true로 전달된다', async () => {
      async function* mockStream() {
        yield { token: 'ok', model: 'gpt-4o' };
      }
      mockFallback.streamWithFallback.mockReturnValue(mockStream());

      const command = new GatewayCallCommand(messages, 'rag-qa', 'default');
      await collect(service.stream(command));

      const trackCall = mockCostTracking.track.mock.calls[0][0];
      expect(trackCall.fallbackUsed).toBe(true);
      expect(trackCall.model).toBe('gpt-4o');
    });

    it('첫 번째 모델이 성공하면 fallbackUsed는 false이다', async () => {
      async function* mockStream() {
        yield { token: 'ok', model: 'claude-sonnet-4-6' };
      }
      mockFallback.streamWithFallback.mockReturnValue(mockStream());

      const command = new GatewayCallCommand(messages, 'rag-qa', 'default');
      await collect(service.stream(command));

      const trackCall = mockCostTracking.track.mock.calls[0][0];
      expect(trackCall.fallbackUsed).toBe(false);
    });

    it('스트리밍 실패 시 오류를 그대로 전파한다', async () => {
      async function* failStream(): AsyncIterable<{
        token?: string;
        model: string;
      }> {
        throw new Error('모든 폴백 실패');
        yield { token: 'unreachable', model: 'x' };
      }
      mockFallback.streamWithFallback.mockReturnValue(failStream());

      const command = new GatewayCallCommand(messages, 'rag-qa', 'default');
      await expect(collect(service.stream(command))).rejects.toThrow(
        '모든 폴백 실패',
      );
    });
  });
});
