import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { BullModule } from '@nestjs/bull';
import { TypeOrmExModule } from '@libs/common/databases/typeorm/typeorm-ex.module';
import PersonalDatabaseConfig from '@libs/common/config/database/personal-database.config';
import { DataSourceOptions } from 'typeorm';
import { AuthModule } from '@libs/auth';
import { AdminServerConfig } from './config/admin-server-config';
import { GrpcClientsModule } from './grpc-clients.module';
import { MailNotificationConsumer } from './mail/mail-notification.consumer';
import { UserModule } from './user/user.module';
import { AdminAuthGrpcController } from './auth/admin-auth.grpc-controller';
import { RpcErrorFilter } from './common/rpc-exception.filter';

@Module({
  imports: [
    AdminServerConfig,
    TypeOrmExModule.forRootAsync({
      name: PersonalDatabaseConfig().name,
      inject: [PersonalDatabaseConfig.KEY],
      useFactory: (config: DataSourceOptions) => config,
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_DB_HOST,
        port: Number(process.env.REDIS_DB_PORT),
      },
    }),
    GrpcClientsModule,
    AuthModule,
    UserModule,
  ],
  controllers: [AdminAuthGrpcController],
  providers: [
    MailNotificationConsumer,
    { provide: APP_FILTER, useClass: RpcErrorFilter },
  ],
})
export class AdminServerModule {}
