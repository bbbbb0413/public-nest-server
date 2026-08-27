import { Payment } from '../model/payment';

export interface IPaymentIdempotencyRepository {
  /** 이미 처리 완료된(COMPLETED/FAILED) 결과가 있으면 반환하고, 없으면 null을 반환한다. */
  findByKey(idempotencyKey: string): Promise<Payment | null>;
  /** 해당 키의 처리를 이 요청이 선점하면 true, 이미 다른 요청이 선점했으면 false를 반환한다. */
  tryClaim(idempotencyKey: string, ttlSeconds: number): Promise<boolean>;
  /** 처리 완료된 결과를 저장해 이후 동일 키 요청이 이 결과를 재사용하도록 한다. */
  save(idempotencyKey: string, payment: Payment, ttlSeconds: number): Promise<void>;
}

export const IPaymentIdempotencyRepository = Symbol('IPaymentIdempotencyRepository');
