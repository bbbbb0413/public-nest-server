import { AuthServerConfig } from './config/auth-server-config';
import { Module } from '@nestjs/common';
import { IdentityController } from './default/identity.controller';
import PersonalDatabaseConfig from '@libs/common/config/database/personal-database.config';
import GameDatabaseConfig from '@libs/common/config/database/game-database.config';
import { TypeOrmExModule } from '@libs/common/databases/typeorm/typeorm-ex.module';
import { DataSourceOptions } from 'typeorm';
import { ClsModule } from 'nestjs-cls';

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

    PrometheusModule.register(),
    AccountModule,
    MailModule,
  ],
  controllers: [IdentityController],
  providers: [],
})
export class IdentityModule {}
