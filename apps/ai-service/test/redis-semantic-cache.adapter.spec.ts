import { ConfigService } from '@nestjs/config';
import { RedisSemanticCacheAdapter } from '../src/qa/infrastructure/cache/redis-semantic-cache.adapter';

describe('RedisSemanticCacheAdapter', () => {
  let adapter: RedisSemanticCacheAdapter;
  let mockRedis: {
    call: jest.Mock;
    hset: jest.Mock;
    expire: jest.Mock;
  };
  let mockConfigService: { get: jest.Mock };

  beforeEach(() => {
    mockRedis = {
      call: jest.fn(),
      hset: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    };
    mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };

    adapter = new RedisSemanticCacheAdapter(
      mockConfigService as unknown as ConfigService,
    );
    Object.defineProperty(adapter, 'redis', {
      value: mockRedis,
      writable: true,
    });
    jest.spyOn(adapter, 'createRedisClient').mockImplementation(() => undefined);
  });

  describe('onModuleInit', () => {
    it('FT.CREATE로 인덱스를 생성한다', async () => {
      // Arrange
      mockRedis.call.mockResolvedValueOnce('OK');

      // Act
      await adapter.onModuleInit();

      // Assert
      expect(mockRedis.call).toHaveBeenCalledWith(
        'FT.CREATE',
        'sem_cache_idx',
        'ON',
        'HASH',
        'PREFIX',
        '1',
        'sem:cache:',
        'SCHEMA',
        'embedding',
        'VECTOR',
        'HNSW',
        '6',
        'TYPE',
        'FLOAT32',
        'DIM',
        '1536',
        'DISTANCE_METRIC',
        'COSINE',
        'tenant',
        'TAG',
      );
    });

    it('인덱스가 이미 존재하면 에러를 무시한다', async () => {
      // Arrange
      mockRedis.call.mockRejectedValueOnce(
        new Error('Index already exists'),
      );

      // Act & Assert
      await expect(adapter.onModuleInit()).resolves.not.toThrow();
    });

    it('인덱스 생성 중 다른 에러는 그대로 던진다', async () => {
      // Arrange
      mockRedis.call.mockRejectedValueOnce(new Error('connection refused'));

      // Act & Assert
      await expect(adapter.onModuleInit()).rejects.toThrow(
        'connection refused',
      );
    });
  });

  describe('findSimilar', () => {
    it('임계값 이상의 유사도를 가진 결과가 있으면 반환한다', async () => {
      // Arrange
      mockRedis.call.mockResolvedValueOnce([
        1,
        'sem:cache:abc',
        ['answer', '캐시된 답변', 'dist', '0.1'],
      ]);

      // Act
      const result = await adapter.findSimilar([0.1, 0.2], 0.85, 'default');

      // Assert
      expect(result).toEqual({ answer: '캐시된 답변', score: 0.9 });
    });

    it('검색 결과가 없으면 null을 반환한다', async () => {
      // Arrange
      mockRedis.call.mockResolvedValueOnce([0]);

      // Act
      const result = await adapter.findSimilar([0.1, 0.2], 0.85, 'default');

      // Assert
      expect(result).toBeNull();
    });

    it('유사도가 임계값보다 낮으면 null을 반환한다', async () => {
      // Arrange
      mockRedis.call.mockResolvedValueOnce([
        1,
        'sem:cache:abc',
        ['answer', '캐시된 답변', 'dist', '0.5'],
      ]);

      // Act
      const result = await adapter.findSimilar([0.1, 0.2], 0.85, 'default');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('store', () => {
    it('임베딩과 답변을 해시로 저장하고 TTL을 설정한다', async () => {
      // Act
      await adapter.store([0.1, 0.2], '질문', '답변', 3600, 'default');

      // Assert
      expect(mockRedis.hset).toHaveBeenCalledWith(
        expect.stringMatching(/^sem:cache:/),
        expect.objectContaining({
          answer: '답변',
          question: '질문',
          tenant: 'default',
        }),
      );
      expect(mockRedis.expire).toHaveBeenCalledWith(
        expect.stringMatching(/^sem:cache:/),
        3600,
      );
    });
  });
});
