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
      get: jest.fn(),
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
      const { job, isNew } = await service.createJob('user-1', 'rag.ask');

      expect(isNew).toBe(true);
      expect(job.userId).toBe('user-1');
      expect(job.type).toBe('rag.ask');
      expect(job.status).toBe('queued');
      expect(job.jobId).toBeDefined();
      expect(mockRedis.hset).toHaveBeenCalledWith(`job:${job.jobId}`, expect.objectContaining({
        jobId: job.jobId,
        userId: 'user-1',
        type: 'rag.ask',
        status: 'queued',
      }));
      expect(mockRedis.expire).toHaveBeenCalledWith(`job:${job.jobId}`, 3600);
    });

    it('idempotencyKey를 처음 쓰면 새 잡을 만들고 선점 키를 EX/NX로 설정한다', async () => {
      const { job, isNew } = await service.createJob('user-1', 'rag.ask', 'idem-1');

      expect(isNew).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'job:idem:user-1:idem-1',
        job.jobId,
        'EX',
        3600,
        'NX',
      );
    });

    it('같은 idempotencyKey로 재요청하면 기존 잡을 그대로 반환하고 새로 만들지 않는다', async () => {
      mockRedis.set.mockResolvedValueOnce(null); // 선점 실패 = 이미 존재
      const existingJob = {
        jobId: 'existing-job-1',
        userId: 'user-1',
        type: 'rag.ask',
        status: 'processing',
        createdAt: '2026-08-28T00:00:00.000Z',
      };
      mockRedis.get.mockResolvedValueOnce('existing-job-1');
      mockRedis.hgetall.mockResolvedValueOnce(existingJob);

      const { job, isNew } = await service.createJob('user-1', 'rag.ask', 'idem-1');

      expect(isNew).toBe(false);
      expect(job).toEqual(existingJob);
      // 새 잡을 실제로 저장하지 않아야 한다 (선점 실패 후 바로 반환)
      expect(mockRedis.hset).not.toHaveBeenCalled();
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
