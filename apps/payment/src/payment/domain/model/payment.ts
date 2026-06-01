import { AggregateRoot } from '@libs/shared-kernel';
import { Money } from '../vo/money.vo';

export class Payment extends AggregateRoot {
  private constructor(
    readonly id: number,
    readonly userId: number,
    readonly money: Money,
    readonly paymentMethod: string,
    readonly productId: string,
    readonly quantity: string,
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
  }): Payment {
    return new Payment(
      props.id,
      props.userId,
      Money.of(props.amount, props.currency),
      props.paymentMethod,
      props.productId,
      props.quantity,
    );
  }
}
