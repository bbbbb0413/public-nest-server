import { DomainEvent } from '@libs/shared-kernel';

export interface PaymentFailedEventPayload {
  paymentId: number;
  userId: number;
  amount: number;
  currency: string;
  productId: string;
}

export class PaymentFailedEvent extends DomainEvent {
  static readonly EVENT_TYPE = 'payment.failed';

  constructor(readonly payload: PaymentFailedEventPayload) {
    super();
  }
}
