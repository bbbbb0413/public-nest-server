import { Redis } from 'ioredis';
import redisConfig from '../../config/redis.config';

export class RedisFactory {
  static createRedisClient(dbNumber = 0): Redis {
    const { port, sshUsed } = redisConfig();

    let host: string = redisConfig().host;

    if (sshUsed) {
      host = '0.0.0.0';
    }
    return new Redis({
      host: host,
      port: port,
      db: dbNumber,
    });
  }
}
