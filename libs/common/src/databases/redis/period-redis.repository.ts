import { AbstractRedisRepository } from '@libs/common/databases/redis/abstract-redis.repository';

export abstract class PeriodRedisRepository<T> extends AbstractRedisRepository {
  protected abstract readonly key: string;
  protected abstract readonly expiration: number;
  async get(fun: () => Promise<T[]>): Promise<T[]> {
    const data = await this.redis.get(this.key);
    if (!data) {
      const rows = await fun();
      await this.redis.setex(this.key, this.expiration, JSON.stringify(rows));
      return rows;
    }
    return JSON.parse(data);
  }
}
