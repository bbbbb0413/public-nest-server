import { JobStoreService } from './job-store.service';
import { RedisFactory } from '@libs/common/databases/redis/redis.factory';

describe('JobStoreService', () => {
  let service: JobStoreService;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      hset: jest.fn().mockResolvedValue(1),
      hgetall: jest.fn(),
      expire: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn(),
    };
    jest.spyOn(RedisFactory, 'createRedisClient').mockReturnValue(mockRedis);
    service = new JobStoreService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createJob', () => {
    it('잡 메타를 생성하고 Redis에 해시로 저장하며 만료 시간을 설정한다', async () => {
      const meta = await service.createJob('user-1', 'rag.ask');

      expect(meta.userId).toBe('user-1');
      expect(meta.type).toBe('rag.ask');
      expect(meta.status).toBe('queued');
      expect(meta.jobId).toBeDefined();
      expect(mockRedis.hset).toHaveBeenCalledWith(`job:${meta.jobId}`, expect.objectContaining({
        jobId: meta.jobId,
        userId: 'user-1',
        type: 'rag.ask',
        status: 'queued',
      }));
      expect(mockRedis.expire).toHaveBeenCalledWith(`job:${meta.jobId}`, 3600);
    });
  });

  describe('getJob', () => {
    it('존재하는 잡 메타를 정상 조회한다', async () => {
      const mockMeta = {
        jobId: 'job-123',
        userId: 'user-1',
        type: 'rag.ask',
        status: 'processing',
        createdAt: '2026-08-22T00:00:00.000Z',
      };
      mockRedis.hgetall.mockResolvedValue(mockMeta);

      const result = await service.getJob('job-123');

      expect(result).toEqual(mockMeta);
      expect(mockRedis.hgetall).toHaveBeenCalledWith('job:job-123');
    });

    it('존재하지 않는 잡일 경우 null을 반환한다', async () => {
      mockRedis.hgetall.mockResolvedValue({});

      const result = await service.getJob('job-nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('cancelJob', () => {
    it('취소 표시 메서드 호출 시 Redis에 취소 상태 및 만료 시간을 기록한다', async () => {
      await service.cancelJob('job-123');

      expect(mockRedis.hset).toHaveBeenCalledWith(
        'job:job-123',
        'status',
        'cancelled',
      );
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'job:job-123',
        'cancelled',
        'true',
      );
      expect(mockRedis.expire).toHaveBeenCalledWith('job:job-123', 3600);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'job:job-123:cancelled',
        '1',
        'EX',
        3600,
      );
    });
  });
});
