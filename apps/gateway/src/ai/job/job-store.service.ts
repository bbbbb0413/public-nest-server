import { randomUUID } from 'crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { RedisFactory } from '@libs/common/databases/redis/redis.factory';

export type AiJobType = 'rag.ask' | 'knowledge.ingest';
export type AiJobStatus = 'queued' | 'processing' | 'done' | 'error' | 'cancelled';

export interface AiJobMeta {
  jobId: string;
  userId: string;
  type: AiJobType;
  status: AiJobStatus;
  createdAt: string;
}

export interface AiJobCreationResult {
  job: AiJobMeta;
  /** false면 idempotencyKey로 이미 존재하던 잡을 그대로 반환한 것 — 재발행하면 안 된다. */
  isNew: boolean;
}

const JOB_TTL_SECONDS = 60 * 60;

@Injectable()
export class JobStoreService implements OnModuleDestroy {
  private readonly redis: Redis = RedisFactory.createRedisClient();

  onModuleDestroy(): void {
    this.redis.disconnect();
  }

  async createJob(
    userId: string,
    type: AiJobType,
    idempotencyKey?: string,
  ): Promise<AiJobCreationResult> {
    const meta: AiJobMeta = {
      jobId: randomUUID(),
      userId,
      type,
      status: 'queued',
      createdAt: new Date().toISOString(),
    };

    if (idempotencyKey) {
      const claimKey = this.idempotencyKey(userId, idempotencyKey);
      // 먼저 이 잡ID로 선점을 시도한다 — 동시에 같은 키로 들어온 요청 중 하나만 성공한다.
      const claimed = await this.redis.set(
        claimKey,
        meta.jobId,
        'EX',
        JOB_TTL_SECONDS,
        'NX',
      );
      if (claimed !== 'OK') {
        const existingJobId = await this.redis.get(claimKey);
        const existing = existingJobId ? await this.getJob(existingJobId) : null;
        if (existing) {
          return { job: existing, isNew: false };
        }
        // 선점한 잡이 이미 만료되어 사라진 드문 경합 — 새로 진행한다.
      }
    }

    const key = this.jobKey(meta.jobId);
    await this.redis.hset(key, { ...meta });
    await this.redis.expire(key, JOB_TTL_SECONDS);

    return { job: meta, isNew: true };
  }

  async getJob(jobId: string): Promise<AiJobMeta | null> {
    const raw = await this.redis.hgetall(this.jobKey(jobId));
    if (Object.keys(raw).length === 0) {
      return null;
    }
    return raw as unknown as AiJobMeta;
  }

  async cancelJob(jobId: string): Promise<void> {
    const key = this.jobKey(jobId);
    await this.redis.hset(key, 'status', 'cancelled');
    await this.redis.hset(key, 'cancelled', 'true');
    await this.redis.expire(key, JOB_TTL_SECONDS);
    await this.redis.set(this.cancelKey(jobId), '1', 'EX', JOB_TTL_SECONDS);
  }

  private jobKey(jobId: string): string {
    return `job:${jobId}`;
  }

  private cancelKey(jobId: string): string {
    return `job:${jobId}:cancelled`;
  }

  private idempotencyKey(userId: string, idempotencyKey: string): string {
    return `job:idem:${userId}:${idempotencyKey}`;
  }
}
