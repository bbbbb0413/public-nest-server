import { Test, TestingModule } from '@nestjs/testing';
import { PaymentOutboxRelayService } from './payment-outbox-relay.service';
import { PaymentKafkaProducerService } from './payment-kafka-producer.service';
import { IPaymentOutboxRepository } from '../../domain/repository/payment-outbox.repository';

const mockOutboxRepository = () => ({
  findPendingBatch: jest.fn(),
  markPublished: jest.fn(),
  markFailedAttempt: jest.fn(),
});

const mockProducer = () => ({
  publish: jest.fn(),
});

describe('PaymentOutboxRelayService', () => {
  let service: PaymentOutboxRelayService;
  let outboxRepository: ReturnType<typeof mockOutboxRepository>;
  let producer: ReturnType<typeof mockProducer>;

  beforeEach(async () => {
    outboxRepository = mockOutboxRepository();
    producer = mockProducer();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentOutboxRelayService,
        { provide: IPaymentOutboxRepository, useValue: outboxRepository },
        { provide: PaymentKafkaProducerService, useValue: producer },
      ],
    }).compile();

    service = module.get<PaymentOutboxRelayService>(PaymentOutboxRelayService);
  });

  it('대기 중인 이벤트를 발행하고 성공하면 PUBLISHED로 표시한다', async () => {
    outboxRepository.findPendingBatch.mockResolvedValue([
      { id: 1, aggregateId: 10, eventType: 'payment.completed', payload: { paymentId: 10 }, attempts: 0 },
    ]);
    producer.publish.mockResolvedValue(undefined);

    await service.pollOnce();

    expect(producer.publish).toHaveBeenCalledWith(
      '10',
      'payment.completed',
      { paymentId: 10 },
    );
    expect(outboxRepository.markPublished).toHaveBeenCalledWith(1);
    expect(outboxRepository.markFailedAttempt).not.toHaveBeenCalled();
  });

  it('발행이 실패하면 다음 폴링을 위해 실패 횟수만 늘리고 예외를 던지지 않는다', async () => {
    outboxRepository.findPendingBatch.mockResolvedValue([
      { id: 2, aggregateId: 20, eventType: 'payment.completed', payload: {}, attempts: 1 },
    ]);
    producer.publish.mockRejectedValue(new Error('broker unreachable'));

    await expect(service.pollOnce()).resolves.toBeUndefined();

    expect(outboxRepository.markFailedAttempt).toHaveBeenCalledWith(2, 5);
    expect(outboxRepository.markPublished).not.toHaveBeenCalled();
  });

  it('이전 폴링이 끝나지 않았으면 다음 tick은 건너뛴다', async () => {
    let resolveFirstPublish: () => void;
    outboxRepository.findPendingBatch.mockResolvedValue([
      { id: 3, aggregateId: 30, eventType: 'payment.completed', payload: {}, attempts: 0 },
    ]);
    producer.publish.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveFirstPublish = resolve;
      }),
    );

    const firstPoll = service.pollOnce();
    const secondPoll = service.pollOnce();

    resolveFirstPublish();
    await Promise.all([firstPoll, secondPoll]);

    expect(outboxRepository.findPendingBatch).toHaveBeenCalledTimes(1);
  });
});
