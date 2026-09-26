import { PaymentGrpcMapper } from './payment.grpc-mapper';
import { Payment } from '../domain/model/payment';
import { PaymentStatus } from '../domain/model/payment-status.enum';
import { CreatePaymentRequest } from '@libs/rpc';

describe('PaymentGrpcMapper', () => {
  describe('toCommand', () => {
    it('CreatePaymentRequest를 CreatePaymentCommand로 정상 변환해야 한다', () => {
      const request: CreatePaymentRequest = {
        accountId: 100,
        amount: 5000,
        currency: 'KRW',
        productId: 'prod_sword_01',
        idempotencyKey: 'idem-key-1',
      };

      const command = PaymentGrpcMapper.toCommand(request);

      expect(command.userId).toBe(100);
      expect(command.amount).toBe(5000);
      expect(command.currency).toBe('KRW');
      expect(command.paymentMethod).toBe('gRPC');
      expect(command.productId).toBe('prod_sword_01');
      expect(command.quantity).toBe('1');
      expect(command.idempotencyKey).toBe('idem-key-1');
    });
  });

  describe('toReply', () => {
    it('Payment 도메인 엔티티를 PaymentReply로 매핑할 때 productId와 accountId가 정상 포함되어야 한다', () => {
      const payment = Payment.restore({
        id: 1,
        userId: 42,
        amount: 15000,
        currency: 'KRW',
        paymentMethod: 'card',
        productId: 'prod_shield_01',
        quantity: '1',
        status: PaymentStatus.COMPLETED,
      });

      const reply = PaymentGrpcMapper.toReply(payment);

      expect(reply.paymentId).toBe(1);
      expect(reply.accountId).toBe(42);
      expect(reply.amount).toBe(15000);
      expect(reply.currency).toBe('KRW');
      expect(reply.productId).toBe('prod_shield_01');
      expect(reply.status).toBe(PaymentStatus.COMPLETED);
    });

    it('createdAt이 존재할 때 ISO 8601 문자열로 변환하여 PaymentReply에 포함해야 한다', () => {
      const createdAt = new Date('2026-09-12T14:30:00.000Z');
      const payment = Payment.restore({
        id: 1,
        userId: 42,
        amount: 15000,
        currency: 'KRW',
        paymentMethod: 'card',
        productId: 'prod_shield_01',
        quantity: '1',
        status: PaymentStatus.COMPLETED,
        createdAt,
      });

      const reply = PaymentGrpcMapper.toReply(payment);

      expect(reply.createdAt).toBe('2026-09-12T14:30:00.000Z');
    });

    it('createdAt이 없을 때 빈 문자열로 반환해야 한다', () => {
      const payment = Payment.restore({
        id: 1,
        userId: 42,
        amount: 15000,
        currency: 'KRW',
        paymentMethod: 'card',
        productId: 'prod_shield_01',
        quantity: '1',
        status: PaymentStatus.COMPLETED,
      });

      const reply = PaymentGrpcMapper.toReply(payment);

      expect(reply.createdAt).toBe('');
    });
  });
});
