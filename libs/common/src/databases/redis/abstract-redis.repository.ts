import { Redis, RedisKey } from 'ioredis';
import { RedisFactory } from '@libs/common/databases/redis/redis.factory';
import { ChainableCommander, Result } from 'ioredis/built/utils/RedisCommander';

export abstract class AbstractRedisRepository {
  protected redis: Redis;
  protected readonly dbNumber: number;

  createRedisClient(): void {
    this.redis = RedisFactory.createRedisClient(this.dbNumber);
  }

  get(key: string): Promise<string> {
    return this.redis.get(key);
  }

  set(key: string, value: string): Promise<string> {
    return this.redis.set(key, value);
  }

  /**
   * redis flush db
   */
  flushDb(): Promise<'OK'> {
    return this.redis.flushdb();
  }

  /**
   * redis 서버 종료
   */
  close(): Promise<'OK'> {
    return this.redis.quit();
  }

  /**
   * redis 특정 키 삭제
   */
  del(...args: [keys: string[]] | [...keys: string[]]): Promise<number> {
    return this.redis.del(args as string[]);
  }

  /**
   * redis ttl
   */
  ttl(key: RedisKey): Promise<number> {
    return this.redis.ttl(key);
  }

  pipeline(): ChainableCommander {
    return this.redis.pipeline();
  }

  async renameKey(key: string, newKey: string): Promise<void> {
    await this.redis.rename(key, newKey);
  }

  async zAdd(key: string, scoreMember: number[]): Promise<void> {
    await this.redis.zadd(key, ...scoreMember);
  }

}
