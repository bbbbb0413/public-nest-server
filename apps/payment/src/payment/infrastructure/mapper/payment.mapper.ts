import { Payment } from '../../domain/model/payment';
import { PaymentOrmEntity } from '../orm/payment.orm-entity';

export class PaymentMapper {
  static toDomain(orm: PaymentOrmEntity): Payment {
    return Payment.restore({
      id: orm.id,
      userId: orm.userId,
      amount: orm.amount,
      currency: orm.currency,
      paymentMethod: orm.paymentMethod,
      productId: orm.productId,
      quantity: orm.quantity,
    });
  }

  static toOrmEntity(domain: Payment): PaymentOrmEntity {
    const orm = new PaymentOrmEntity();
    if (domain.id !== undefined) orm.id = domain.id;
    orm.userId = domain.userId;
    orm.amount = domain.money.getAmount();
    orm.currency = domain.money.getCurrency();
    orm.paymentMethod = domain.paymentMethod;
    orm.productId = domain.productId;
    orm.quantity = domain.quantity;
    return orm;
  }
}
