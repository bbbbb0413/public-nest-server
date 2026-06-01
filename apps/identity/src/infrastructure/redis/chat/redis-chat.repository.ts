import { Injectable } from '@nestjs/common';
import { AbstractRedisRepository } from '@libs/common/databases/redis/abstract-redis.repository';
import { Chat } from './redis-chat.entity';

@Injectable()
export class RedisChatRepository extends AbstractRedisRepository {
  protected readonly dbNumber = Number(process.env.CHAT_REDIS_DB_NUMBER) || 0;

  constructor() {
    super();
    this.createRedisClient();
  }

  async hSet(key: string, field: any, value: any): Promise<void> {
    await this.redis.hset(key, field, JSON.stringify(value));
  }

  async hGet(key: string, field: string): Promise<any> {
    return JSON.parse(await this.redis.hget(key, field));
  }

  async hGelAll(key: string): Promise<Record<string, string>> {
    return this.redis.hgetall(key);
  }

  async hDel(key: string, value: any): Promise<void> {
    await this.redis.hdel(key, value);
  }

  async setKey(key: string, value: any, ttl = 0): Promise<void> {
    const json = JSON.stringify(value);
    if (0 < ttl) {
      await this.redis.set(key, json, 'EX', ttl);
    } else {
      await this.redis.set(key, json);
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    await this.redis.expire(key, ttl);
  }

  async getKey(key: string): Promise<any> {
    return JSON.parse(await this.redis.get(key));
  }

  async delKey(key: string): Promise<any> {
    await this.redis.del(key);
  }

  async saveChat(key: string, value: Chat): Promise<void> {
    await this.redis.rpush(key, JSON.stringify(value));
  }

  async getAllChat(key: string): Promise<string[]> {
    return this.redis.lrange(key, 0, -1);
  }

  async popChat(key: string): Promise<string> {
    return this.redis.lpop(key);
  }
}
