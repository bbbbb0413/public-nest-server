import { DomainEvent } from '@libs/shared-kernel';
import { Payment } from '../model/payment';

export interface IPaymentRepository {
  persist(payment: Payment): Promise<Payment>;
  /** 결제 저장과 해당 상태 변경으로 발생한 도메인 이벤트의 outbox 적재를 하나의 트랜잭션으로 처리한다. */
  persistWithEvents(payment: Payment, events: DomainEvent[]): Promise<Payment>;
  findPaymentById(id: number): Promise<Payment | null>;
  findAllAndCount(
    take: number,
    skip: number,
    orderBy: 'ASC' | 'DESC',
  ): Promise<[Payment[], number]>;
}

export const IPaymentRepository = Symbol('IPaymentRepository');
