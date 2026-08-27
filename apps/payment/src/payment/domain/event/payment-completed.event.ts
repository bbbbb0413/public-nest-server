import { DomainEvent } from '@libs/shared-kernel';

export interface PaymentCompletedEventPayload {
  paymentId: number;
  userId: number;
  amount: number;
  currency: string;
  productId: string;
}

export class PaymentCompletedEvent extends DomainEvent {
  static readonly EVENT_TYPE = 'payment.completed';

  constructor(readonly payload: PaymentCompletedEventPayload) {
    super();
  }
}
