import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { RedisFactory } from '@libs/common/databases/redis/redis.factory';

const FILE_TTL_SECONDS = 60 * 60;

@Injectable()
export class KnowledgeFileStagingService implements OnModuleDestroy {
  private readonly redis: Redis = RedisFactory.createRedisClient();

  onModuleDestroy(): void {
    this.redis.disconnect();
  }

  async stage(jobId: string, content: Buffer): Promise<void> {
    const key = this.fileKey(jobId);
    await this.redis.set(key, content.toString('base64'));
    await this.redis.expire(key, FILE_TTL_SECONDS);
  }

  private fileKey(jobId: string): string {
    return `ai:job:${jobId}:file`;
  }
}
