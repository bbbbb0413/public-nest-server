import { CreatePaymentRequest, PaymentReply } from '@libs/rpc';
import { CreatePaymentCommand } from '../application/command/create-payment.command';
import { Payment } from '../domain/model/payment';

export class PaymentGrpcMapper {
  static toCommand(request: CreatePaymentRequest): CreatePaymentCommand {
    return new CreatePaymentCommand(
      request.accountId,
      request.amount,
      request.currency,
      'gRPC', // default paymentMethod
      request.productId,
      '1', // default quantity
      request.idempotencyKey,
    );
  }

  static toReply(payment: Payment): PaymentReply {
    return {
      id: payment.id,
      amount: payment.money.getAmount(),
      currency: payment.money.getCurrency(),
      status: payment.status,
    };
  }
}
