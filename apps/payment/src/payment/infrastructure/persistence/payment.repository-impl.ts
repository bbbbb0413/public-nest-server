import { EntityRepository } from '@libs/common/databases/typeorm/typeorm-ex.decorator';
import { AbstractRepository } from '@libs/common/databases/typeorm/abstract.repository';
import { DomainEvent } from '@libs/shared-kernel';
import { PaymentOrmEntity } from '../orm/payment.orm-entity';
import { IPaymentRepository } from '../../domain/repository/payment.repository';
import { Payment } from '../../domain/model/payment';
import { PaymentMapper } from '../mapper/payment.mapper';
import { PaymentOutboxOrmEntity } from '../orm/payment-outbox.orm-entity';
import { PaymentOutboxMapper } from '../mapper/payment-outbox.mapper';

@EntityRepository(PaymentOrmEntity)
export class PaymentRepositoryImpl
  extends AbstractRepository<PaymentOrmEntity>
  implements IPaymentRepository
{
  async persist(payment: Payment): Promise<Payment> {
    const orm = PaymentMapper.toOrmEntity(payment);
    const saved = await super.save(orm);
    return PaymentMapper.toDomain(saved as PaymentOrmEntity);
  }

  async persistWithEvents(
    payment: Payment,
    events: DomainEvent[],
  ): Promise<Payment> {
    const orm = PaymentMapper.toOrmEntity(payment);

    const saved = await this.manager.transaction(async (manager) => {
      const savedPayment = await manager.save(PaymentOrmEntity, orm);
      if (events.length > 0) {
        const outboxRows = events.map((event) =>
          PaymentOutboxMapper.toOrmEntity(savedPayment.id, event),
        );
        await manager.save(PaymentOutboxOrmEntity, outboxRows);
      }
      return savedPayment;
    });

    return PaymentMapper.toDomain(saved);
  }

  async findPaymentById(id: number): Promise<Payment | null> {
    const orm = await this.queryBuilder
      .where(`${this.alias}.id = :id`, { id })
      .getOne();
    return orm ? PaymentMapper.toDomain(orm) : null;
  }

  async findAllAndCount(
    take: number,
    skip: number,
    orderBy: 'ASC' | 'DESC',
  ): Promise<[Payment[], number]> {
    const [orms, count] = await this.queryBuilder
      .take(take)
      .skip(skip)
      .orderBy(`${this.alias}.id`, orderBy)
      .getManyAndCount();
    return [orms.map(PaymentMapper.toDomain), count];
  }

  async findPaymentsByUserId(
    userId: number,
    take: number,
    skip: number,
  ): Promise<[Payment[], number]> {
    const [orms, count] = await this.queryBuilder
      .where(`${this.alias}.userId = :userId`, { userId })
      .take(take)
      .skip(skip)
      .orderBy(`${this.alias}.id`, 'DESC')
      .getManyAndCount();
    return [orms.map(PaymentMapper.toDomain), count];
  }
}
