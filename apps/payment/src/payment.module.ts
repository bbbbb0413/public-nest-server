import { PaymentServerConfig } from './config/payment-server-config';
import { Module } from '@nestjs/common';
import { PaymentController } from './default/payment.controller';
import { TypeOrmExModule } from '@libs/common/databases/typeorm/typeorm-ex.module';
import { DataSourceOptions } from 'typeorm';
import { ClsModule } from 'nestjs-cls';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import PaymentDatabaseConfig from '@libs/common/config/database/payment-database.config';
import PersonalDatabaseConfig from '@libs/common/config/database/personal-database.config';

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

    PaymentBcModule,
    PrometheusModule.register(),
  ],
  controllers: [PaymentController],
  providers: [],
})
export class PaymentModule {}
