import { Module } from '@nestjs/common';
import { TypeOrmExModule } from '@libs/common/databases/typeorm/typeorm-ex.module';
import { DataSourceOptions } from 'typeorm';
import { ClsModule } from 'nestjs-cls';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from '@libs/auth';
import {
  RedisClusterModule,
  RedisChatZsetRepository,
  ShardedPubSubService,
  IPubSubPort,
} from '@libs/rpc/chat-realtime';
import { GrpcClientsModule } from './grpc-clients.module';
import { PaymentGatewayController } from './payment/payment-gateway.controller';
import { IdentityGatewayController } from './identity/identity-gateway.controller';
import { AdminGatewayController } from './admin/admin-gateway.controller';
import { ChatGateway } from './chat/chat-gateway.gateway';
import PersonalDatabaseConfig from '@libs/common/config/database/personal-database.config';
import { GatewayConfigModule } from './config/gateway-config.module';
import { AiGatewayModule } from './ai/ai-gateway.module';

@Module({
  imports: [
    GatewayConfigModule,
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),

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

    AuthModule,
    GrpcClientsModule,
    AiGatewayModule,
    RedisClusterModule,
  ],
  controllers: [
    PaymentGatewayController,
    IdentityGatewayController,
    AdminGatewayController,
  ],
  providers: [
    ChatGateway,
    ShardedPubSubService,
    RedisChatZsetRepository,
    { provide: IPubSubPort, useClass: ShardedPubSubService },
    {
      // chat-service의 SHARD_COUNT와 반드시 동일해야 pub/sub 채널이 맞물린다
      provide: 'SHARD_COUNT',
      useValue: 10,
    },
  ],
})
export class GatewayModule {}
