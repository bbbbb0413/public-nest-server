import { PaymentMapper } from './payment.mapper';
import { PaymentOrmEntity } from '../orm/payment.orm-entity';
import { PaymentStatus } from '../../domain/model/payment-status.enum';

describe('PaymentMapper', () => {
  it('ORM 엔티티의 createdAt을 도메인 모델로 정상 전달해야 한다', () => {
    const orm = new PaymentOrmEntity();
    orm.id = 1;
    orm.userId = 100;
    orm.amount = 15000;
    orm.currency = 'KRW';
    orm.paymentMethod = 'card';
    orm.productId = 'prod_001';
    orm.quantity = '1';
    orm.status = PaymentStatus.COMPLETED;
    orm.createdAt = new Date('2026-09-12T14:30:00.000Z');

    const domain = PaymentMapper.toDomain(orm);

    expect(domain.id).toBe(1);
    expect(domain.userId).toBe(100);
    expect(domain.money.getAmount()).toBe(15000);
    expect(domain.productId).toBe('prod_001');
    expect(domain.status).toBe(PaymentStatus.COMPLETED);
    expect(domain.createdAt).toEqual(new Date('2026-09-12T14:30:00.000Z'));
  });
});
