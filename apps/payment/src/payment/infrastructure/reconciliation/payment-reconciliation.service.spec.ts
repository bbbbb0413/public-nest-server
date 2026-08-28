import { Test, TestingModule } from '@nestjs/testing';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { IPgAdapter } from '../../domain/port/pg-adapter.port';
import { IPaymentRepository } from '../../domain/repository/payment.repository';
import { Payment } from '../../domain/model/payment';
import { PaymentStatus } from '../../domain/model/payment-status.enum';

const mockPgAdapter = () => ({
  requestApproval: jest.fn(),
  listTransactions: jest.fn(),
  verifyWebhookSignature: jest.fn(),
});

const mockPaymentRepository = () => ({
  persist: jest.fn(),
  persistWithEvents: jest.fn(),
  findPaymentById: jest.fn(),
  findAllAndCount: jest.fn(),
  findPaymentsByUserId: jest.fn(),
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

describe('PaymentReconciliationService', () => {
  let service: PaymentReconciliationService;
  let pgAdapter: ReturnType<typeof mockPgAdapter>;
  let paymentRepository: ReturnType<typeof mockPaymentRepository>;

  beforeEach(async () => {
    pgAdapter = mockPgAdapter();
    paymentRepository = mockPaymentRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentReconciliationService,
        { provide: IPgAdapter, useValue: pgAdapter },
        { provide: IPaymentRepository, useValue: paymentRepository },
      ],
    }).compile();

    service = module.get<PaymentReconciliationService>(
      PaymentReconciliationService,
    );
  });

  it('PG와 내부 상태가 일치하면 불일치 없이 완료된다', async () => {
    pgAdapter.listTransactions.mockResolvedValue([
      {
        pgTransactionId: 'pg-tx-1',
        paymentId: 1,
        amount: 10000,
        approved: true,
        approvedAt: new Date(),
      },
    ]);
    paymentRepository.findPaymentById.mockResolvedValue(
      buildPayment(PaymentStatus.COMPLETED),
    );

    const result = await service.reconcileOnce();

    expect(result).toEqual({ checked: 1, mismatches: [] });
  });

  it('PG는 승인했는데 내부는 다른 상태면 불일치로 잡는다', async () => {
    pgAdapter.listTransactions.mockResolvedValue([
      {
        pgTransactionId: 'pg-tx-1',
        paymentId: 1,
        amount: 10000,
        approved: true,
        approvedAt: new Date(),
      },
    ]);
    paymentRepository.findPaymentById.mockResolvedValue(
      buildPayment(PaymentStatus.PENDING),
    );

    const result = await service.reconcileOnce();

    expect(result.checked).toBe(1);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]).toContain('상태 불일치');
  });

  it('PG에는 있는데 내부 DB에 결제가 없으면 불일치로 잡는다', async () => {
    pgAdapter.listTransactions.mockResolvedValue([
      {
        pgTransactionId: 'pg-tx-1',
        paymentId: 999,
        amount: 10000,
        approved: true,
        approvedAt: new Date(),
      },
    ]);
    paymentRepository.findPaymentById.mockResolvedValue(null);

    const result = await service.reconcileOnce();

    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]).toContain('내부 DB에 없음');
  });
});
