import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { IPaymentOutboxRepository } from '../../domain/repository/payment-outbox.repository';
import { PaymentKafkaProducerService } from './payment-kafka-producer.service';

const POLL_INTERVAL_MS =
  Number(process.env.PAYMENT_OUTBOX_POLL_INTERVAL_MS) || 2000;
const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;

@Injectable()
export class PaymentOutboxRelayService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PaymentOutboxRelayService.name);
  private timer: NodeJS.Timeout;
  private polling = false;

  constructor(
    @Inject(IPaymentOutboxRepository)
    private readonly outboxRepository: IPaymentOutboxRepository,
    private readonly producer: PaymentKafkaProducerService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.pollOnce(), POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async pollOnce(): Promise<void> {
    if (this.polling) {
      // 이전 폴링이 아직 끝나지 않았으면 이번 tick은 건너뛴다.
      return;
    }
    this.polling = true;
    try {
      const pendingEvents =
        await this.outboxRepository.findPendingBatch(BATCH_SIZE);

      for (const outboxEvent of pendingEvents) {
        try {
          await this.producer.publish(
            String(outboxEvent.aggregateId),
            outboxEvent.eventType,
            outboxEvent.payload,
          );
          await this.outboxRepository.markPublished(outboxEvent.id);
        } catch (error) {
          this.logger.warn(
            `outbox 이벤트 발행 실패, 다음 폴링에서 재시도합니다: id=${outboxEvent.id} eventType=${outboxEvent.eventType} error=${(error as Error).message}`,
          );
          await this.outboxRepository.markFailedAttempt(
            outboxEvent.id,
            MAX_ATTEMPTS,
          );
        }
      }
    } finally {
      this.polling = false;
    }
  }
}
