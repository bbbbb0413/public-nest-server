import { Payment } from '../model/payment';

export interface IPaymentRepository {
  persist(payment: Payment): Promise<Payment>;
  findPaymentById(id: number): Promise<Payment | null>;
  findAllAndCount(
    take: number,
    skip: number,
    orderBy: 'ASC' | 'DESC',
  ): Promise<[Payment[], number]>;
}

export const IPaymentRepository = Symbol('IPaymentRepository');
