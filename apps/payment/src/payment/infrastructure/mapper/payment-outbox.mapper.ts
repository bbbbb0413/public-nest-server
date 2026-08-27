import { DomainEvent } from '@libs/shared-kernel';
import { PaymentOutboxOrmEntity } from '../orm/payment-outbox.orm-entity';
import { OutboxStatus } from '../../domain/model/outbox-status.enum';
import { PaymentCompletedEvent } from '../../domain/event/payment-completed.event';
import { PaymentFailedEvent } from '../../domain/event/payment-failed.event';

export class PaymentOutboxMapper {
  static toOrmEntity(
    aggregateId: number,
    event: DomainEvent,
  ): PaymentOutboxOrmEntity {
    const { eventType, payload } = PaymentOutboxMapper.resolve(event);

    const orm = new PaymentOutboxOrmEntity();
    orm.aggregateId = aggregateId;
    orm.eventType = eventType;
    orm.payload = JSON.stringify(payload);
    orm.status = OutboxStatus.PENDING;
    orm.attempts = 0;
    orm.publishedAt = null;
    return orm;
  }

  private static resolve(event: DomainEvent): {
    eventType: string;
    payload: unknown;
  } {
    if (event instanceof PaymentCompletedEvent) {
      return {
        eventType: PaymentCompletedEvent.EVENT_TYPE,
        payload: { ...event.payload, occurredAt: event.occurredAt },
      };
    }
    if (event instanceof PaymentFailedEvent) {
      return {
        eventType: PaymentFailedEvent.EVENT_TYPE,
        payload: { ...event.payload, occurredAt: event.occurredAt },
      };
    }
    throw new Error(`알 수 없는 도메인 이벤트입니다: ${event.constructor.name}`);
  }
}
