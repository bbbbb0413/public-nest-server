import { Module } from '@nestjs/common';
import { TypeOrmExModule } from '@libs/common/databases/typeorm/typeorm-ex.module';
import PersonalDatabaseConfig from '@libs/common/config/database/personal-database.config';
import { PaymentController } from './presentation/payment.controller';
import { PaymentGrpcController } from './rpc/payment.grpc-controller';
import { CreatePaymentUseCase } from './application/create-payment.use-case';
import { IPaymentRepository } from './domain/repository/payment.repository';
import { PaymentRepositoryImpl } from './infrastructure/persistence/payment.repository-impl';
import { IPaymentIdempotencyRepository } from './domain/repository/payment-idempotency.repository';
import { PaymentIdempotencyRepositoryImpl } from './infrastructure/idempotency/payment-idempotency.repository-impl';
import { IPaymentOutboxRepository } from './domain/repository/payment-outbox.repository';
import { PaymentOutboxRepositoryImpl } from './infrastructure/persistence/payment-outbox.repository-impl';
import { PaymentKafkaClientModule } from './infrastructure/messaging/payment-kafka-client.module';
import { PaymentKafkaProducerService } from './infrastructure/messaging/payment-kafka-producer.service';
import { PaymentOutboxRelayService } from './infrastructure/messaging/payment-outbox-relay.service';
import { IPgAdapter } from './domain/port/pg-adapter.port';
import { MockPgAdapter } from './infrastructure/pg/mock-pg.adapter';
import { HandlePgWebhookUseCase } from './application/handle-pg-webhook.use-case';
import { PgWebhookController } from './presentation/pg-webhook.controller';
import { PaymentReconciliationService } from './infrastructure/reconciliation/payment-reconciliation.service';

@Module({
  imports: [
    TypeOrmExModule.forFeatures(
      [PaymentRepositoryImpl, PaymentOutboxRepositoryImpl],
      [PersonalDatabaseConfig().name],
    ),
    PaymentKafkaClientModule,
  ],
  controllers: [PaymentController, PaymentGrpcController, PgWebhookController],
  providers: [
    CreatePaymentUseCase,
    HandlePgWebhookUseCase,
    { provide: IPaymentRepository, useExisting: PaymentRepositoryImpl },
    PaymentIdempotencyRepositoryImpl,
    {
      provide: IPaymentIdempotencyRepository,
      useExisting: PaymentIdempotencyRepositoryImpl,
    },
    {
      provide: IPaymentOutboxRepository,
      useExisting: PaymentOutboxRepositoryImpl,
    },
    PaymentKafkaProducerService,
    PaymentOutboxRelayService,
    MockPgAdapter,
    { provide: IPgAdapter, useExisting: MockPgAdapter },
    PaymentReconciliationService,
  ],
})
export class PaymentBcModule {}
