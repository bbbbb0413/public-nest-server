import { Module } from '@nestjs/common';
import { TypeOrmExModule } from '@libs/common/databases/typeorm/typeorm-ex.module';
import PersonalDatabaseConfig from '@libs/common/config/database/personal-database.config';
import { PaymentController } from './presentation/payment.controller';
import { CreatePaymentUseCase } from './application/create-payment.use-case';
import { IPaymentRepository } from './domain/repository/payment.repository';
import { PaymentRepositoryImpl } from './infrastructure/persistence/payment.repository-impl';

@Module({
  imports: [
    TypeOrmExModule.forFeatures(
      [PaymentRepositoryImpl],
      [PersonalDatabaseConfig().name],
    ),
  ],
  controllers: [PaymentController],
  providers: [
    CreatePaymentUseCase,
    { provide: IPaymentRepository, useClass: PaymentRepositoryImpl },
  ],
})
export class PaymentBcModule {}
