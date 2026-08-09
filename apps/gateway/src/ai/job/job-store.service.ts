import { randomUUID } from 'crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { RedisFactory } from '@libs/common/databases/redis/redis.factory';

export type AiJobType = 'rag.ask' | 'knowledge.ingest';
export type AiJobStatus = 'queued' | 'processing' | 'done' | 'error';

export interface AiJobMeta {
  jobId: string;
  userId: string;
  type: AiJobType;
  status: AiJobStatus;
  createdAt: string;
}

const JOB_TTL_SECONDS = 60 * 60;

@Injectable()
export class JobStoreService implements OnModuleDestroy {
  private readonly redis: Redis = RedisFactory.createRedisClient();

  onModuleDestroy(): void {
    this.redis.disconnect();
  }

  async createJob(userId: string, type: AiJobType): Promise<AiJobMeta> {
    const meta: AiJobMeta = {
      jobId: randomUUID(),
      userId,
      type,
      status: 'queued',
      createdAt: new Date().toISOString(),
    };

    const key = this.jobKey(meta.jobId);
    await this.redis.hset(key, { ...meta });
    await this.redis.expire(key, JOB_TTL_SECONDS);

    return meta;
  }

  async getJob(jobId: string): Promise<AiJobMeta | null> {
    const raw = await this.redis.hgetall(this.jobKey(jobId));
    if (Object.keys(raw).length === 0) {
      return null;
    }
    return raw as unknown as AiJobMeta;
  }

  private jobKey(jobId: string): string {
    return `job:${jobId}`;
  }
}
