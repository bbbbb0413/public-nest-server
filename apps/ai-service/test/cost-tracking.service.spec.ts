import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CostTrackingService } from '../src/llm-gateway/application/cost-tracking.service';
import {
  ILlmCostLogRepository,
  LlmCostLogRepository,
} from '../src/llm-gateway/domain/repository/llm-cost-log.repository';
import { TokenUsage } from '../src/llm-gateway/domain/vo/token-usage.vo';

describe('CostTrackingService', () => {
  let service: CostTrackingService;
  let mockRepo: jest.Mocked<ILlmCostLogRepository>;
  let mockConfig: jest.Mocked<Pick<ConfigService, 'get'>>;

  const MODEL_COST_TABLE = JSON.stringify({
    'claude-sonnet-4-6': { prompt: 3.0, completion: 15.0 },
    'gpt-4o': { prompt: 2.5, completion: 10.0 },
  });

  beforeEach(async () => {
    mockRepo = {
      persist: jest.fn().mockResolvedValue(undefined),
      sumByModel: jest.fn(),
    } as jest.Mocked<ILlmCostLogRepository>;

    mockConfig = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'MODEL_COST_TABLE') return MODEL_COST_TABLE;
        return undefined;
      }),
    } as jest.Mocked<Pick<ConfigService, 'get'>>;

    const module = await Test.createTestingModule({
      providers: [
        CostTrackingService,
        { provide: LlmCostLogRepository, useValue: mockRepo },
        {
          provide: ConfigService,
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get(CostTrackingService);
  });

  describe('track()', () => {
    it('토큰 사용량으로 비용을 계산하고 저장한다', async () => {
      const usage = TokenUsage.of(1000, 500);
      await service.track({
        model: 'claude-sonnet-4-6',
        feature: 'rag-qa',
        tenant: 'default',
        usage,
        fallbackUsed: false,
        attemptedModels: ['claude-sonnet-4-6'],
      });

      expect(mockRepo.persist).toHaveBeenCalledTimes(1);
      const [log] = mockRepo.persist.mock.calls[0];
      // 비용 = (1000 * 3.0 + 500 * 15.0) / 1_000_000 = (3000 + 7500) / 1_000_000 = 0.0105
      expect(log.costUsd).toBeCloseTo(0.0105, 6);
      expect(log.model).toBe('claude-sonnet-4-6');
      expect(log.fallbackUsed).toBe(false);
    });

    it('fallback 사용 시 fallbackUsed가 true로 기록된다', async () => {
      const usage = TokenUsage.of(500, 200);
      await service.track({
        model: 'gpt-4o',
        feature: 'rag-qa',
        tenant: 'default',
        usage,
        fallbackUsed: true,
        attemptedModels: ['claude-sonnet-4-6', 'gpt-4o'],
      });

      const [log] = mockRepo.persist.mock.calls[0];
      expect(log.fallbackUsed).toBe(true);
      expect(log.attemptedModels).toEqual(['claude-sonnet-4-6', 'gpt-4o']);
    });

    it('알 수 없는 모델은 비용 0으로 기록한다', async () => {
      const usage = TokenUsage.of(1000, 500);
      await service.track({
        model: 'unknown-model',
        feature: 'rag-qa',
        tenant: 'default',
        usage,
        fallbackUsed: false,
        attemptedModels: ['unknown-model'],
      });

      const [log] = mockRepo.persist.mock.calls[0];
      expect(log.costUsd).toBe(0);
    });

    it('비용 추적 실패 시 오류를 전파하지 않는다(silent)', async () => {
      mockRepo.persist.mockRejectedValue(new Error('DB Error'));
      const usage = TokenUsage.of(100, 50);

      await expect(
        service.track({
          model: 'claude-sonnet-4-6',
          feature: 'rag-qa',
          tenant: 'default',
          usage,
          fallbackUsed: false,
          attemptedModels: ['claude-sonnet-4-6'],
        }),
      ).resolves.not.toThrow();
    });
  });
});
