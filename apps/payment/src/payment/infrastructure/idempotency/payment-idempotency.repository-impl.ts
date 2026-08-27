import { Injectable } from '@nestjs/common';
import { AbstractRedisRepository } from '@libs/common/databases/redis/abstract-redis.repository';
import { Payment } from '../../domain/model/payment';
import { PaymentStatus } from '../../domain/model/payment-status.enum';
import { IPaymentIdempotencyRepository } from '../../domain/repository/payment-idempotency.repository';

const PAYMENT_IDEMPOTENCY_DB = 4;
const KEY_PREFIX = 'payment:idempotency:';
const PROCESSING_MARKER = '__PROCESSING__';

interface StoredPayment {
  id: number;
  userId: number;
  amount: number;
  currency: string;
  paymentMethod: string;
  productId: string;
  quantity: string;
  status: PaymentStatus;
}

@Injectable()
export class PaymentIdempotencyRepositoryImpl
  extends AbstractRedisRepository
  implements IPaymentIdempotencyRepository
{
  protected readonly dbNumber = PAYMENT_IDEMPOTENCY_DB;

  constructor() {
    super();
    this.createRedisClient();
  }

  async findByKey(idempotencyKey: string): Promise<Payment | null> {
    const raw = await this.redis.get(this.buildKey(idempotencyKey));
    if (!raw || raw === PROCESSING_MARKER) {
      return null;
    }
    return Payment.restore(JSON.parse(raw) as StoredPayment);
  }

  async tryClaim(idempotencyKey: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(
      this.buildKey(idempotencyKey),
      PROCESSING_MARKER,
      'EX',
      ttlSeconds,
      'NX',
    );
    return result === 'OK';
  }

  async save(
    idempotencyKey: string,
    payment: Payment,
    ttlSeconds: number,
  ): Promise<void> {
    const stored: StoredPayment = {
      id: payment.id,
      userId: payment.userId,
      amount: payment.money.getAmount(),
      currency: payment.money.getCurrency(),
      paymentMethod: payment.paymentMethod,
      productId: payment.productId,
      quantity: payment.quantity,
      status: payment.status,
    };
    await this.redis.setex(
      this.buildKey(idempotencyKey),
      ttlSeconds,
      JSON.stringify(stored),
    );
  }

  private buildKey(idempotencyKey: string): string {
    return `${KEY_PREFIX}${idempotencyKey}`;
  }
}
