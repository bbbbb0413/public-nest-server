import { Column, Entity } from 'typeorm';
import {
  AbstractEntity,
  BaseTimeEntity,
} from '@libs/common/databases/typeorm/abstract.entity';
import { OutboxStatus } from '../../domain/model/outbox-status.enum';

@Entity('payment_outbox')
@BaseTimeEntity()
export class PaymentOutboxOrmEntity extends AbstractEntity {
  @Column()
  aggregateId: number;

  @Column()
  eventType: string;

  @Column({ type: 'text' })
  payload: string;

  @Column({ type: 'varchar', default: OutboxStatus.PENDING })
  status: OutboxStatus;

  @Column({ default: 0 })
  attempts: number;

  @Column({ type: 'datetime', nullable: true })
  publishedAt: Date | null;
}
