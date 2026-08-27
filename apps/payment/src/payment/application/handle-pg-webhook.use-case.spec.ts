import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { HandlePgWebhookUseCase } from './handle-pg-webhook.use-case';
import { HandlePgWebhookCommand } from './command/handle-pg-webhook.command';
import { IPaymentRepository } from '../domain/repository/payment.repository';
import { Payment } from '../domain/model/payment';
import { PaymentStatus } from '../domain/model/payment-status.enum';

const mockPaymentRepository = () => ({
  persist: jest.fn(),
  persistWithEvents: jest.fn(),
  findPaymentById: jest.fn(),
  findAllAndCount: jest.fn(),
});

const buildPayment = (status: PaymentStatus): Payment =>
  Payment.restore({
    id: 1,
    userId: 100,
    amount: 10000,
    currency: 'KRW',
    paymentMethod: 'card',
    productId: 'product-001',
    quantity: '1',
    status,
  });

describe('HandlePgWebhookUseCase', () => {
  let useCase: HandlePgWebhookUseCase;
  let paymentRepository: ReturnType<typeof mockPaymentRepository>;

  beforeEach(async () => {
    paymentRepository = mockPaymentRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandlePgWebhookUseCase,
        { provide: IPaymentRepository, useValue: paymentRepository },
      ],
    }).compile();

    useCase = module.get<HandlePgWebhookUseCase>(HandlePgWebhookUseCase);
  });

  it('PENDING 결제에 승인 웹훅이 오면 COMPLETED로 전이한다', async () => {
    paymentRepository.findPaymentById.mockResolvedValue(
      buildPayment(PaymentStatus.PENDING),
    );

    await useCase.execute(new HandlePgWebhookCommand(1, 'pg-tx-1', true));

    expect(paymentRepository.persistWithEvents).toHaveBeenCalledWith(
      expect.objectContaining({ status: PaymentStatus.COMPLETED }),
      expect.any(Array),
    );
  });

  it('PENDING 결제에 실패 웹훅이 오면 FAILED로 전이한다', async () => {
    paymentRepository.findPaymentById.mockResolvedValue(
      buildPayment(PaymentStatus.PENDING),
    );

    await useCase.execute(new HandlePgWebhookCommand(1, 'pg-tx-2', false));

    expect(paymentRepository.persistWithEvents).toHaveBeenCalledWith(
      expect.objectContaining({ status: PaymentStatus.FAILED }),
      expect.any(Array),
    );
  });

  it('이미 COMPLETED인 결제에 같은 웹훅이 다시 오면 아무것도 갱신하지 않는다 (멱등)', async () => {
    paymentRepository.findPaymentById.mockResolvedValue(
      buildPayment(PaymentStatus.COMPLETED),
    );

    await useCase.execute(new HandlePgWebhookCommand(1, 'pg-tx-1', true));

    expect(paymentRepository.persistWithEvents).not.toHaveBeenCalled();
  });

  it('존재하지 않는 결제 ID면 NotFoundException을 던진다', async () => {
    paymentRepository.findPaymentById.mockResolvedValue(null);

    await expect(
      useCase.execute(new HandlePgWebhookCommand(999, 'pg-tx-3', true)),
    ).rejects.toThrow(NotFoundException);
  });
});
