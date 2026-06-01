import { Inject, Injectable } from '@nestjs/common';
import { CreatePaymentCommand } from './command/create-payment.command';
import { Payment } from '../domain/model/payment';
import { Money } from '../domain/vo/money.vo';
import { IPaymentRepository } from '../domain/repository/payment.repository';

@Injectable()
export class CreatePaymentUseCase {
  constructor(
    @Inject(IPaymentRepository)
    private readonly paymentRepository: IPaymentRepository,
  ) {}

  async execute(command: CreatePaymentCommand): Promise<Payment> {
    const payment = Payment.create({
      userId: command.userId,
      money: Money.of(command.amount, command.currency),
      paymentMethod: command.paymentMethod,
      productId: command.productId,
      quantity: command.quantity,
    });

    return this.paymentRepository.persist(payment);
  }
}
