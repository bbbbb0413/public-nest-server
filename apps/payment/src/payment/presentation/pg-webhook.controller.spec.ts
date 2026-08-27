import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PgWebhookController } from './pg-webhook.controller';
import { HandlePgWebhookUseCase } from '../application/handle-pg-webhook.use-case';
import { IPgAdapter } from '../domain/port/pg-adapter.port';
import { PgWebhookDto } from './dto/pg-webhook.dto';

const mockHandlePgWebhookUseCase = () => ({
  execute: jest.fn(),
});

const mockPgAdapter = () => ({
  requestApproval: jest.fn(),
  listTransactions: jest.fn(),
  verifyWebhookSignature: jest.fn(),
});

describe('PgWebhookController', () => {
  let controller: PgWebhookController;
  let handlePgWebhookUseCase: ReturnType<typeof mockHandlePgWebhookUseCase>;
  let pgAdapter: ReturnType<typeof mockPgAdapter>;

  beforeEach(async () => {
    handlePgWebhookUseCase = mockHandlePgWebhookUseCase();
    pgAdapter = mockPgAdapter();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PgWebhookController],
      providers: [
        { provide: HandlePgWebhookUseCase, useValue: handlePgWebhookUseCase },
        { provide: IPgAdapter, useValue: pgAdapter },
      ],
    }).compile();

    controller = module.get<PgWebhookController>(PgWebhookController);
  });

  const dto: PgWebhookDto = {
    pgTransactionId: 'pg-tx-1',
    paymentId: 1,
    status: 'APPROVED',
  };

  it('서명이 유효하면 use case를 실행하고 수신 확인을 반환한다', async () => {
    pgAdapter.verifyWebhookSignature.mockReturnValue(true);

    const result = await controller.handlePgWebhook(dto, 'valid-signature');

    expect(pgAdapter.verifyWebhookSignature).toHaveBeenCalledWith(
      { pgTransactionId: 'pg-tx-1', paymentId: 1, status: 'APPROVED' },
      'valid-signature',
    );
    expect(handlePgWebhookUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 1,
        pgTransactionId: 'pg-tx-1',
        approved: true,
      }),
    );
    expect(result).toEqual({ received: true });
  });

  it('서명이 유효하지 않으면 UnauthorizedException을 던지고 use case를 실행하지 않는다', async () => {
    pgAdapter.verifyWebhookSignature.mockReturnValue(false);

    await expect(
      controller.handlePgWebhook(dto, 'invalid-signature'),
    ).rejects.toThrow(UnauthorizedException);
    expect(handlePgWebhookUseCase.execute).not.toHaveBeenCalled();
  });
});
