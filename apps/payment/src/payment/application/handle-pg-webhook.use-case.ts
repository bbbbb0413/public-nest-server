import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { HandlePgWebhookCommand } from './command/handle-pg-webhook.command';
import { IPaymentRepository } from '../domain/repository/payment.repository';
import { PaymentStatus } from '../domain/model/payment-status.enum';

@Injectable()
export class HandlePgWebhookUseCase {
  constructor(
    @Inject(IPaymentRepository)
    private readonly paymentRepository: IPaymentRepository,
  ) {}

  async execute(command: HandlePgWebhookCommand): Promise<void> {
    const payment = await this.paymentRepository.findPaymentById(
      command.paymentId,
    );
    if (!payment) {
      throw new NotFoundException(
        `결제를 찾을 수 없습니다. paymentId=${command.paymentId}`,
      );
    }

    if (payment.status !== PaymentStatus.PENDING) {
      // 이미 처리된 결제에 대한 웹훅 재전달 — 멱등하게 무시한다.
      return;
    }

    const outcome = command.approved ? payment.complete() : payment.fail();
    const events = outcome.pullDomainEvents();
    await this.paymentRepository.persistWithEvents(outcome, events);
  }
}
