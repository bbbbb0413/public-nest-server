import { AuthServerConfig } from './config/auth-server-config';
import { Module } from '@nestjs/common';
import { IdentityController } from './default/identity.controller';
import { BullModule } from '@nestjs/bull';
import PersonalDatabaseConfig from '@libs/common/config/database/personal-database.config';
import GameDatabaseConfig from '@libs/common/config/database/game-database.config';
import { TypeOrmExModule } from '@libs/common/databases/typeorm/typeorm-ex.module';
import { DataSourceOptions } from 'typeorm';
import { ClsModule } from 'nestjs-cls';
import { AuthModule } from '@libs/auth';

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

    // AuthModule의 'mail' 큐(회원가입 시 메일 발송 job 발행)가 쓰는 Redis 연결.
    // 실제 소비(consume)는 apps/admin-server가 담당한다.
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_DB_HOST,
        port: Number(process.env.REDIS_DB_PORT),
      },
    }),

    PrometheusModule.register(),
    AuthModule,
    AccountModule,
    MailModule,
  ],
  controllers: [IdentityController],
  providers: [],
})
export class IdentityModule {}
