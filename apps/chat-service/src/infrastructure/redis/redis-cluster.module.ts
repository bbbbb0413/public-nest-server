import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'CHAT_REDIS_COMMAND_CLIENT',
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('CHAT_REDIS_HOST', 'localhost');
        const port = configService.get<number>('CHAT_REDIS_PORT', 6379);
        const db = configService.get<number>('CHAT_REDIS_DB_NUMBER', 0);
        const password = configService.get<string>('CHAT_REDIS_PASSWORD');

        return new Redis({
          host,
          port,
          db,
          password,
          // Redis Cluster 환경일 경우 여기에 Cluster 설정을 추가할 수 있습니다.
          // 현재는 단일 인스턴스/DB 분리 구조를 가정합니다.
        });
      },
      inject: [ConfigService],
    },
    {
      provide: 'CHAT_REDIS_PUBSUB_CLIENT',
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('CHAT_REDIS_HOST', 'localhost');
        const port = configService.get<number>('CHAT_REDIS_PORT', 6379);
        const db = configService.get<number>('CHAT_REDIS_DB_NUMBER', 0);
        const password = configService.get<string>('CHAT_REDIS_PASSWORD');

        return new Redis({
          host,
          port,
          db,
          password,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: ['CHAT_REDIS_COMMAND_CLIENT', 'CHAT_REDIS_PUBSUB_CLIENT'],
})
export class RedisClusterModule {}
