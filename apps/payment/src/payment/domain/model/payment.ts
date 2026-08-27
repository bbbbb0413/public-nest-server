import { AggregateRoot } from '@libs/shared-kernel';
import { Money } from '../vo/money.vo';
import { PaymentStatus } from './payment-status.enum';
import { PaymentCompletedEvent } from '../event/payment-completed.event';
import { PaymentFailedEvent } from '../event/payment-failed.event';

export class Payment extends AggregateRoot {
  private constructor(
    readonly id: number,
    readonly userId: number,
    readonly money: Money,
    readonly paymentMethod: string,
    readonly productId: string,
    readonly quantity: string,
    readonly status: PaymentStatus,
  ) {
    super();
  }

  static create(props: {
    userId: number;
    money: Money;
    paymentMethod: string;
    productId: string;
    quantity: string;
  }): Payment {
    return new Payment(
      undefined,
      props.userId,
      props.money,
      props.paymentMethod,
      props.productId,
      props.quantity,
      PaymentStatus.PENDING,
    );
  }

  static restore(props: {
    id: number;
    userId: number;
    amount: number;
    currency: string;
    paymentMethod: string;
    productId: string;
    quantity: string;
    status: PaymentStatus;
  }): Payment {
    return new Payment(
      props.id,
      props.userId,
      Money.of(props.amount, props.currency),
      props.paymentMethod,
      props.productId,
      props.quantity,
      props.status,
    );
  }

  complete(): Payment {
    if (this.status !== PaymentStatus.PENDING) {
      throw new Error(
        `PENDING 상태에서만 완료 처리할 수 있습니다. 현재 상태: ${this.status}`,
      );
    }
    const completed = new Payment(
      this.id,
      this.userId,
      this.money,
      this.paymentMethod,
      this.productId,
      this.quantity,
      PaymentStatus.COMPLETED,
    );
    completed.addDomainEvent(
      new PaymentCompletedEvent({
        paymentId: completed.id,
        userId: completed.userId,
        amount: completed.money.getAmount(),
        currency: completed.money.getCurrency(),
        productId: completed.productId,
      }),
    );
    return completed;
  }

  fail(): Payment {
    if (this.status !== PaymentStatus.PENDING) {
      throw new Error(
        `PENDING 상태에서만 실패 처리할 수 있습니다. 현재 상태: ${this.status}`,
      );
    }
    const failed = new Payment(
      this.id,
      this.userId,
      this.money,
      this.paymentMethod,
      this.productId,
      this.quantity,
      PaymentStatus.FAILED,
    );
    failed.addDomainEvent(
      new PaymentFailedEvent({
        paymentId: failed.id,
        userId: failed.userId,
        amount: failed.money.getAmount(),
        currency: failed.money.getCurrency(),
        productId: failed.productId,
      }),
    );
    return failed;
  }
}
