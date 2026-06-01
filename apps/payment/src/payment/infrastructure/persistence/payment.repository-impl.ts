import { EntityRepository } from '@libs/common/databases/typeorm/typeorm-ex.decorator';
import { AbstractRepository } from '@libs/common/databases/typeorm/abstract.repository';
import { PaymentOrmEntity } from '../orm/payment.orm-entity';
import { IPaymentRepository } from '../../domain/repository/payment.repository';
import { Payment } from '../../domain/model/payment';
import { PaymentMapper } from '../mapper/payment.mapper';

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
}
