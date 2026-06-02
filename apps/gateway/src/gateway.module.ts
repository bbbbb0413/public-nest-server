import { Module } from '@nestjs/common';
import { TypeOrmExModule } from '@libs/common/databases/typeorm/typeorm-ex.module';
import { DataSourceOptions } from 'typeorm';
import { ClsModule } from 'nestjs-cls';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from '@libs/auth';
import { GrpcClientsModule } from './grpc-clients.module';
import { PaymentGatewayController } from './payment/payment-gateway.controller';
import { IdentityGatewayController } from './identity/identity-gateway.controller';
import { ChatGateway } from './chat/chat-gateway.gateway';
import PersonalDatabaseConfig from '@libs/common/config/database/personal-database.config';
import { GatewayConfigModule } from './config/gateway-config.module';

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
  ],
  controllers: [PaymentGatewayController, IdentityGatewayController],
  providers: [ChatGateway],
})
export class GatewayModule {}
