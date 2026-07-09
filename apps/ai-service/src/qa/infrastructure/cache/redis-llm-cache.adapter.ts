import { Injectable, OnModuleInit } from '@nestjs/common';
import { AbstractRedisRepository } from '@libs/common/databases/redis/abstract-redis.repository';
import { ILlmCachePort } from '../../domain/port/llm-cache.port';

const LLM_CACHE_DB = 2;

@Injectable()
export class RedisLlmCacheAdapter
  extends AbstractRedisRepository
  implements ILlmCachePort, OnModuleInit
{
  protected readonly dbNumber = LLM_CACHE_DB;

  onModuleInit(): void {
    this.createRedisClient();
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async setWithTtl(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.set(key, value, 'EX', ttlSeconds);
  }

  async invalidate(key: string): Promise<void> {
    await this.del([key]);
  }
}
