import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { PAYMENT_KAFKA_CLIENT } from './payment-kafka-client.module';

export const PAYMENT_EVENTS_TOPIC = 'payment.events';

@Injectable()
export class PaymentKafkaProducerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PaymentKafkaProducerService.name);

  constructor(
    @Inject(PAYMENT_KAFKA_CLIENT) private readonly client: ClientKafka,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      // Kafka가 일시적으로 죽어 있어도 결제 서비스 기동은 막지 않는다.
      // outbox 릴레이가 이후 폴링에서 발행을 재시도한다.
      this.logger.warn(
        `Kafka producer 연결 실패, outbox 릴레이가 재시도합니다: ${(error as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.close();
    } catch {
      // 연결된 적이 없으면 close도 무해하게 무시한다.
    }
  }

  async publish(
    key: string,
    eventType: string,
    payload: unknown,
  ): Promise<void> {
    await firstValueFrom(
      this.client.emit(PAYMENT_EVENTS_TOPIC, {
        key,
        value: JSON.stringify({ eventType, payload }),
      }),
    );
  }
}
