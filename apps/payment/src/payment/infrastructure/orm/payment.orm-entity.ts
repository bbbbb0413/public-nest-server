import { Column, Entity } from 'typeorm';
import {
  AbstractEntity,
  BaseTimeEntity,
} from '@libs/common/databases/typeorm/abstract.entity';
import { PaymentStatus } from '../../domain/model/payment-status.enum';

@Entity('payment')
@BaseTimeEntity()
export class PaymentOrmEntity extends AbstractEntity {
  @Column()
  userId: number;

  @Column()
  amount: number;

  @Column()
  currency: string;

  @Column()
  paymentMethod: string;

  @Column()
  productId: string;

  @Column()
  quantity: string;

  @Column({ type: 'varchar', default: PaymentStatus.PENDING })
  status: PaymentStatus;
}
