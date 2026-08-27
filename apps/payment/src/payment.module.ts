import { PaymentServerConfig } from './config/payment-server-config';
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PaymentController } from './default/payment.controller';
import { TypeOrmExModule } from '@libs/common/databases/typeorm/typeorm-ex.module';
import { DataSourceOptions } from 'typeorm';
import { ClsModule } from 'nestjs-cls';
import { PrometheusModule, makeHistogramProvider } from '@willsoto/nestjs-prometheus';
import PaymentDatabaseConfig from '@libs/common/config/database/payment-database.config';
import PersonalDatabaseConfig from '@libs/common/config/database/personal-database.config';

import { PaymentBcModule } from './payment/payment-bc.module';
import { HttpMetricsInterceptor } from './metrics/http-metrics.interceptor';

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
  providers: [
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'HTTP 요청 처리 시간(초), 라우트/메서드/상태코드별',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    }),
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
})
export class PaymentModule {}
