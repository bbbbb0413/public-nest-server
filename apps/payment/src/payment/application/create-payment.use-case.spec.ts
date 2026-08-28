import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CreatePaymentUseCase } from './create-payment.use-case';
import { CreatePaymentCommand } from './command/create-payment.command';
import { IPaymentRepository } from '../domain/repository/payment.repository';
import { IPaymentIdempotencyRepository } from '../domain/repository/payment-idempotency.repository';
import { IPgAdapter } from '../domain/port/pg-adapter.port';
import { Payment } from '../domain/model/payment';
import { PaymentStatus } from '../domain/model/payment-status.enum';
import { Money } from '../domain/vo/money.vo';

const mockPaymentRepository = () => ({
  persist: jest.fn(),
  persistWithEvents: jest.fn(),
  findPaymentById: jest.fn(),
  findAllAndCount: jest.fn(),
  findPaymentsByUserId: jest.fn(),
});

const mockPaymentIdempotencyRepository = () => ({
  findByKey: jest.fn(),
  tryClaim: jest.fn(),
  save: jest.fn(),
});

const mockPgAdapter = () => ({
  requestApproval: jest.fn(),
  listTransactions: jest.fn(),
  verifyWebhookSignature: jest.fn(),
});

const buildPendingPaymentFixture = (): Payment =>
  Payment.restore({
    id: 1,
    userId: 100,
    amount: 10000,
    currency: 'KRW',
    paymentMethod: 'card',
    productId: 'product-001',
    quantity: '1',
    status: PaymentStatus.PENDING,
  });

const buildCompletedPaymentFixture = (): Payment =>
  Payment.restore({
    id: 1,
    userId: 100,
    amount: 10000,
    currency: 'KRW',
    paymentMethod: 'card',
    productId: 'product-001',
    quantity: '1',
    status: PaymentStatus.COMPLETED,
  });

const buildFailedPaymentFixture = (): Payment =>
  Payment.restore({
    id: 1,
    userId: 100,
    amount: 10000,
    currency: 'KRW',
    paymentMethod: 'card',
    productId: 'product-001',
    quantity: '1',
    status: PaymentStatus.FAILED,
  });

describe('CreatePaymentUseCase', () => {
  let useCase: CreatePaymentUseCase;
  let paymentRepository: ReturnType<typeof mockPaymentRepository>;
  let paymentIdempotencyRepository: ReturnType<
    typeof mockPaymentIdempotencyRepository
  >;
  let pgAdapter: ReturnType<typeof mockPgAdapter>;

  beforeEach(async () => {
    paymentRepository = mockPaymentRepository();
    paymentIdempotencyRepository = mockPaymentIdempotencyRepository();
    pgAdapter = mockPgAdapter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatePaymentUseCase,
        { provide: IPaymentRepository, useValue: paymentRepository },
        {
          provide: IPaymentIdempotencyRepository,
          useValue: paymentIdempotencyRepository,
        },
        { provide: IPgAdapter, useValue: pgAdapter },
      ],
    }).compile();

    useCase = module.get<CreatePaymentUseCase>(CreatePaymentUseCase);
  });

  it('PG가 승인하면 PENDING으로 저장 후 COMPLETED로 갱신하고 도메인 객체를 반환한다', async () => {
    paymentIdempotencyRepository.findByKey.mockResolvedValue(null);
    paymentIdempotencyRepository.tryClaim.mockResolvedValue(true);
    paymentRepository.persist.mockResolvedValueOnce(
      buildPendingPaymentFixture(),
    );
    pgAdapter.requestApproval.mockResolvedValue({
      approved: true,
      pgTransactionId: 'pg-tx-1',
    });
    paymentRepository.persistWithEvents.mockResolvedValueOnce(
      buildCompletedPaymentFixture(),
    );

    const command = new CreatePaymentCommand(
      100,
      10000,
      'KRW',
      'card',
      'product-001',
      '1',
      'idem-key-1',
    );
    const result = await useCase.execute(command);

    expect(paymentIdempotencyRepository.tryClaim).toHaveBeenCalledWith(
      'idem-key-1',
      expect.any(Number),
    );
    expect(paymentRepository.persist).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 100, status: PaymentStatus.PENDING }),
    );
    expect(pgAdapter.requestApproval).toHaveBeenCalledWith({
      paymentId: 1,
      amount: 10000,
      currency: 'KRW',
      paymentMethod: 'card',
    });
    expect(paymentRepository.persistWithEvents).toHaveBeenCalledWith(
      expect.objectContaining({ status: PaymentStatus.COMPLETED }),
      expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({ paymentId: 1 }),
        }),
      ]),
    );
    expect(paymentIdempotencyRepository.save).toHaveBeenCalledWith(
      'idem-key-1',
      expect.objectContaining({ status: PaymentStatus.COMPLETED }),
      expect.any(Number),
    );
    expect(result.status).toBe(PaymentStatus.COMPLETED);
    expect(result.money.getAmount()).toBe(10000);
    expect(result.money.getCurrency()).toBe('KRW');
  });

  it('PG가 거절하면 FAILED로 저장한다', async () => {
    paymentIdempotencyRepository.findByKey.mockResolvedValue(null);
    paymentIdempotencyRepository.tryClaim.mockResolvedValue(true);
    paymentRepository.persist.mockResolvedValueOnce(
      buildPendingPaymentFixture(),
    );
    pgAdapter.requestApproval.mockResolvedValue({
      approved: false,
      pgTransactionId: 'pg-tx-2',
      reason: '한도 초과',
    });
    paymentRepository.persistWithEvents.mockResolvedValueOnce(
      buildFailedPaymentFixture(),
    );

    const command = new CreatePaymentCommand(
      100,
      10000,
      'KRW',
      'card',
      'product-001',
      '1',
      'idem-key-2',
    );
    const result = await useCase.execute(command);

    expect(paymentRepository.persistWithEvents).toHaveBeenCalledWith(
      expect.objectContaining({ status: PaymentStatus.FAILED }),
      expect.any(Array),
    );
    expect(result.status).toBe(PaymentStatus.FAILED);
  });

  it('PG 승인 요청이 재시도를 다 소진하도록 실패하면 결제를 FAILED로 저장한다', async () => {
    paymentIdempotencyRepository.findByKey.mockResolvedValue(null);
    paymentIdempotencyRepository.tryClaim.mockResolvedValue(true);
    paymentRepository.persist.mockResolvedValueOnce(
      buildPendingPaymentFixture(),
    );
    pgAdapter.requestApproval.mockRejectedValue(new Error('네트워크 오류'));
    paymentRepository.persistWithEvents.mockResolvedValueOnce(
      buildFailedPaymentFixture(),
    );

    const command = new CreatePaymentCommand(
      100,
      10000,
      'KRW',
      'card',
      'product-001',
      '1',
      'idem-key-3',
    );
    const result = await useCase.execute(command);

    expect(pgAdapter.requestApproval).toHaveBeenCalledTimes(3);
    expect(paymentRepository.persistWithEvents).toHaveBeenCalledWith(
      expect.objectContaining({ status: PaymentStatus.FAILED }),
      expect.any(Array),
    );
    expect(result.status).toBe(PaymentStatus.FAILED);
  }, 10000);

  it('이미 처리 완료된 idempotencyKey로 재요청하면 새로 생성하지 않고 기존 결과를 반환한다', async () => {
    const completed = buildCompletedPaymentFixture();
    paymentIdempotencyRepository.findByKey.mockResolvedValue(completed);

    const command = new CreatePaymentCommand(
      100,
      10000,
      'KRW',
      'card',
      'product-001',
      '1',
      'idem-key-1',
    );
    const result = await useCase.execute(command);

    expect(result).toBe(completed);
    expect(paymentIdempotencyRepository.tryClaim).not.toHaveBeenCalled();
    expect(paymentRepository.persist).not.toHaveBeenCalled();
    expect(paymentRepository.persistWithEvents).not.toHaveBeenCalled();
    expect(pgAdapter.requestApproval).not.toHaveBeenCalled();
  });

  it('동일 idempotencyKey를 다른 요청이 이미 처리 중이면 ConflictException을 던진다', async () => {
    paymentIdempotencyRepository.findByKey
      .mockResolvedValueOnce(null) // 최초 조회
      .mockResolvedValueOnce(null); // claim 실패 후 재조회 (아직 완료 안 됨)
    paymentIdempotencyRepository.tryClaim.mockResolvedValue(false);

    const command = new CreatePaymentCommand(
      100,
      10000,
      'KRW',
      'card',
      'product-001',
      '1',
      'idem-key-1',
    );

    await expect(useCase.execute(command)).rejects.toThrow(ConflictException);
    expect(paymentRepository.persist).not.toHaveBeenCalled();
    expect(paymentRepository.persistWithEvents).not.toHaveBeenCalled();
  });

  it('음수 금액은 Money VO 생성 시 에러를 던진다', () => {
    expect(() => Money.of(-1, 'KRW')).toThrow('금액은 0 이상이어야 합니다.');
  });

  it('빈 통화 코드는 Money VO 생성 시 에러를 던진다', () => {
    expect(() => Money.of(1000, '')).toThrow('통화 코드는 필수입니다.');
  });
});
