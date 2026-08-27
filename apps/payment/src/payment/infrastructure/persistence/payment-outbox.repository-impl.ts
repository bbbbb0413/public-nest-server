import { EntityRepository } from '@libs/common/databases/typeorm/typeorm-ex.decorator';
import { AbstractRepository } from '@libs/common/databases/typeorm/abstract.repository';
import { PaymentOutboxOrmEntity } from '../orm/payment-outbox.orm-entity';
import { OutboxStatus } from '../../domain/model/outbox-status.enum';
import {
  IPaymentOutboxRepository,
  OutboxEventRecord,
} from '../../domain/repository/payment-outbox.repository';

@EntityRepository(PaymentOutboxOrmEntity)
export class PaymentOutboxRepositoryImpl
  extends AbstractRepository<PaymentOutboxOrmEntity>
  implements IPaymentOutboxRepository
{
  async findPendingBatch(limit: number): Promise<OutboxEventRecord[]> {
    const rows = await this.queryBuilder
      .where(`${this.alias}.status = :status`, { status: OutboxStatus.PENDING })
      .orderBy(`${this.alias}.id`, 'ASC')
      .take(limit)
      .getMany();

    return rows.map((row) => ({
      id: row.id,
      aggregateId: row.aggregateId,
      eventType: row.eventType,
      payload: JSON.parse(row.payload),
      attempts: row.attempts,
    }));
  }

  async markPublished(id: number): Promise<void> {
    await this.updateById(id, {
      status: OutboxStatus.PUBLISHED,
      publishedAt: new Date(),
    });
  }

  async markFailedAttempt(id: number, maxAttempts: number): Promise<void> {
    const row = await this.findById(id);
    if (!row) {
      return;
    }
    const attempts = row.attempts + 1;
    await this.updateById(id, {
      attempts,
      status: attempts >= maxAttempts ? OutboxStatus.FAILED : OutboxStatus.PENDING,
    });
  }
}
