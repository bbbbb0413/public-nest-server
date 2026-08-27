import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { CreatePaymentCommand } from './command/create-payment.command';
import { Payment } from '../domain/model/payment';
import { Money } from '../domain/vo/money.vo';
import { IPaymentRepository } from '../domain/repository/payment.repository';
import { IPaymentIdempotencyRepository } from '../domain/repository/payment-idempotency.repository';
import { IPgAdapter } from '../domain/port/pg-adapter.port';
import { retryWithBackoff } from '../infrastructure/pg/backoff-retry.util';

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24; // 24시간
const PG_RETRY_MAX_ATTEMPTS = 3;
const PG_RETRY_BASE_DELAY_MS = 200;

@Injectable()
export class CreatePaymentUseCase {
  private readonly logger = new Logger(CreatePaymentUseCase.name);

  constructor(
    @Inject(IPaymentRepository)
    private readonly paymentRepository: IPaymentRepository,
    @Inject(IPaymentIdempotencyRepository)
    private readonly paymentIdempotencyRepository: IPaymentIdempotencyRepository,
    @Inject(IPgAdapter)
    private readonly pgAdapter: IPgAdapter,
  ) {}

  async execute(command: CreatePaymentCommand): Promise<Payment> {
    const existing = await this.paymentIdempotencyRepository.findByKey(
      command.idempotencyKey,
    );
    if (existing) {
      return existing;
    }

    const claimed = await this.paymentIdempotencyRepository.tryClaim(
      command.idempotencyKey,
      IDEMPOTENCY_TTL_SECONDS,
    );
    if (!claimed) {
      const inFlightResult = await this.paymentIdempotencyRepository.findByKey(
        command.idempotencyKey,
      );
      if (inFlightResult) {
        return inFlightResult;
      }
      throw new ConflictException(
        `이미 처리 중인 요청입니다. idempotencyKey=${command.idempotencyKey}`,
      );
    }

    const payment = Payment.create({
      userId: command.userId,
      money: Money.of(command.amount, command.currency),
      paymentMethod: command.paymentMethod,
      productId: command.productId,
      quantity: command.quantity,
    });

    const pending = await this.paymentRepository.persist(payment);

    let outcome: Payment;
    try {
      const approval = await retryWithBackoff(
        () =>
          this.pgAdapter.requestApproval({
            paymentId: pending.id,
            amount: pending.money.getAmount(),
            currency: pending.money.getCurrency(),
            paymentMethod: pending.paymentMethod,
          }),
        { maxAttempts: PG_RETRY_MAX_ATTEMPTS, baseDelayMs: PG_RETRY_BASE_DELAY_MS },
      );
      outcome = approval.approved ? pending.complete() : pending.fail();
    } catch (error) {
      this.logger.warn(
        `PG 승인 요청이 ${PG_RETRY_MAX_ATTEMPTS}회 재시도 후에도 실패해 결제를 실패 처리합니다. paymentId=${pending.id} error=${(error as Error).message}`,
      );
      outcome = pending.fail();
    }

    const domainEvents = outcome.pullDomainEvents();
    const saved = await this.paymentRepository.persistWithEvents(
      outcome,
      domainEvents,
    );

    await this.paymentIdempotencyRepository.save(
      command.idempotencyKey,
      saved,
      IDEMPOTENCY_TTL_SECONDS,
    );

    return saved;
  }
}
