import { Column, Entity } from 'typeorm';
import {
  AbstractEntity,
  BaseTimeEntity,
} from '@libs/common/databases/typeorm/abstract.entity';

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
}
