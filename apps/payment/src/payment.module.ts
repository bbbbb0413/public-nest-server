import { PaymentServerConfig } from './config/payment-server-config';
import { Module } from '@nestjs/common';
import { PaymentController } from './default/payment.controller';
import { TypeOrmExModule } from '@libs/common/databases/typeorm/typeorm-ex.module';
import { DataSourceOptions } from 'typeorm';
import { ClsModule } from 'nestjs-cls';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import PaymentDatabaseConfig from '@libs/common/config/database/payment-database.config';
import PersonalDatabaseConfig from '@libs/common/config/database/personal-database.config';
import { AuthModule } from '@libs/auth';

import { BullModule } from '@nestjs/bull';
import { PaymentBcModule } from './payment/payment-bc.module';

@Module({
  imports: [
    PaymentServerConfig,
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),

    ...[PaymentDatabaseConfig, PersonalDatabaseConfig].map((it) => {
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
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),

    AuthModule,
    PaymentBcModule,
    PrometheusModule.register(),
  ],
  controllers: [PaymentController],
  providers: [],
})
export class PaymentModule {}
