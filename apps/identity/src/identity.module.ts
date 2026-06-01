import { AuthServerConfig } from './config/auth-server-config';
import { Module } from '@nestjs/common';
import { IdentityController } from './default/identity.controller';
import { GroqProvider } from '@libs/common/provider/groq.provider';
import { BullModule } from '@nestjs/bull';
import { QueueController } from './queue/queue.controller';
import { QueueService } from './queue/queue.service';
import { QueueConsumerProvider } from './queue/queue-consumer.provider';
import PersonalDatabaseConfig from '@libs/common/config/database/personal-database.config';
import GameDatabaseConfig from '@libs/common/config/database/game-database.config';
import { TypeOrmExModule } from '@libs/common/databases/typeorm/typeorm-ex.module';
import { DataSourceOptions } from 'typeorm';
import { ClsModule } from 'nestjs-cls';
import { AuthModule } from '@libs/auth';

import { ChatGateway } from './socket/chat.gateway';
import { GroqController } from './groq/groq.controller';
import { GroqService } from './groq/groq.service';
import { RedisChatRepository } from './infrastructure/redis/chat/redis-chat.repository';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { AccountModule } from './account/account.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    AuthServerConfig,
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),

    ...[PersonalDatabaseConfig, GameDatabaseConfig].map((it) => {
      return TypeOrmExModule.forRootAsync({
        name: it().name,
        inject: [it.KEY],
        useFactory: (config: DataSourceOptions) => config,
      });
    }),

    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_DB_HOST,
        port: Number(process.env.REDIS_DB_PORT),
      },
    }),
    BullModule.registerQueue({
      name: 'test',
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),

    PrometheusModule.register(),
    AuthModule,
    AccountModule,
    MailModule,
  ],
  controllers: [IdentityController, GroqController, QueueController],
  providers: [
    GroqService,
    QueueService,
    GroqProvider,
    QueueConsumerProvider,
    ChatGateway,
    RedisChatRepository,
  ],
})
export class IdentityModule {}
