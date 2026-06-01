import { TestingModule } from '@nestjs/testing';
import { AbstractRedisRepository } from '@libs/common/databases/redis/abstract-redis.repository';
import { SessionRepository } from '@libs/auth/auth/infrastructure/session/session.repository';

export class TestRedisDataSourceUtils {
  /**
   * 모든 레디스 정보 클리어
   */
  static async clearRedisDataSource(module: TestingModule): Promise<void> {
    const redisDataSourceMap =
      await TestRedisDataSourceUtils.getRedisRepositories(module);

    await TestRedisDataSourceUtils.redisFlushDb(module);

    await Promise.all(redisDataSourceMap.map(async (it) => await it.close()));
  }

  /**
   * 레디스 데이터 초기화
   */
  static async redisFlushDb(module: TestingModule): Promise<void> {
    const redisDataSourceMap =
      await TestRedisDataSourceUtils.getRedisRepositories(module);

    await Promise.all(redisDataSourceMap.map(async (it) => await it.flushDb()));
  }

  /**
   * 모든 레디스 레포지토리 조회
   */
  static async getRedisRepositories(
    module: TestingModule,
  ): Promise<AbstractRedisRepository[]> {
    const redisDataSourceMap = [];

    // session
    try {
      const sessionRepository =
        module.get<SessionRepository>(SessionRepository);
      redisDataSourceMap.push(sessionRepository);
    } catch (e) {
      /* empty */
    }

    return redisDataSourceMap;
  }
}
