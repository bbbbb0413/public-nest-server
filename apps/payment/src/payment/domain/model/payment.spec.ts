import { Payment } from './payment';
import { PaymentStatus } from './payment-status.enum';
import { Money } from '../vo/money.vo';
import { PaymentCompletedEvent } from '../event/payment-completed.event';
import { PaymentFailedEvent } from '../event/payment-failed.event';

describe('Payment', () => {
  const buildPending = (): Payment =>
    Payment.restore({
      id: 1,
      userId: 100,
      amount: 10000,
      currency: 'KRW',
      paymentMethod: 'card',
      productId: 'product-001',
      quantity: '1',
      status: PaymentStatus.PENDING,
    });

  it('create()는 PENDING 상태의 결제를 생성한다', () => {
    const payment = Payment.create({
      userId: 100,
      money: Money.of(10000, 'KRW'),
      paymentMethod: 'card',
      productId: 'product-001',
      quantity: '1',
    });

    expect(payment.status).toBe(PaymentStatus.PENDING);
    expect(payment.pullDomainEvents()).toEqual([]);
  });

  it('complete()는 상태를 COMPLETED로 전이하고 PaymentCompletedEvent를 발생시킨다', () => {
    const pending = buildPending();
    const completed = pending.complete();

    expect(completed.status).toBe(PaymentStatus.COMPLETED);
    const events = completed.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(PaymentCompletedEvent);
    expect((events[0] as PaymentCompletedEvent).payload).toEqual({
      paymentId: 1,
      userId: 100,
      amount: 10000,
      currency: 'KRW',
      productId: 'product-001',
    });
  });

  it('fail()은 상태를 FAILED로 전이하고 PaymentFailedEvent를 발생시킨다', () => {
    const pending = buildPending();
    const failed = pending.fail();

    expect(failed.status).toBe(PaymentStatus.FAILED);
    const events = failed.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(PaymentFailedEvent);
  });

  it('이미 COMPLETED인 결제는 다시 complete()할 수 없다', () => {
    const completed = buildPending().complete();
    expect(() => completed.complete()).toThrow(
      'PENDING 상태에서만 완료 처리할 수 있습니다. 현재 상태: COMPLETED',
    );
  });

  it('pullDomainEvents()를 호출하면 내부 이벤트 큐가 비워진다', () => {
    const completed = buildPending().complete();
    expect(completed.pullDomainEvents()).toHaveLength(1);
    expect(completed.pullDomainEvents()).toHaveLength(0);
  });
});
