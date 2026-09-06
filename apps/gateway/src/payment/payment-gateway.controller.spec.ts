import { Test, TestingModule } from '@nestjs/testing';
import { PaymentGatewayController } from './payment-gateway.controller';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { of } from 'rxjs';
import { PaymentReply, ListPaymentsResponse } from '@libs/rpc';

describe('PaymentGatewayController', () => {
  let controller: PaymentGatewayController;
  let mockPaymentServiceClient: any;

  beforeEach(async () => {
    mockPaymentServiceClient = {
      createPayment: jest.fn(),
      listPayments: jest.fn(),
      getPayment: jest.fn(),
    };

    const mockClientGrpc = {
      getService: jest.fn().mockReturnValue(mockPaymentServiceClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentGatewayController],
      providers: [
        {
          provide: 'PAYMENT_SERVICE',
          useValue: mockClientGrpc,
        },
      ],
    }).compile();

    controller = module.get<PaymentGatewayController>(PaymentGatewayController);
    controller.onModuleInit();
  });

  const mockSession = {
    id: 'session-123',
    uuid: 'user-uuid-123',
    nickName: 'Tester',
    gameDbId: 42,
    database: 'game_db',
  };

  describe('createPayment', () => {
    it('결제 생성 요청 시 gRPC 응답의 productId와 accountId를 포함하여 ResponseEntity로 반환해야 한다', async () => {
      const dto: CreatePaymentDto = {
        amount: 10000,
        currency: 'KRW',
        productId: 'prod_sword_01',
        idempotencyKey: 'idem-123',
      };

      const expectedReply: PaymentReply = {
        paymentId: 1,
        accountId: 42,
        amount: 10000,
        currency: 'KRW',
        productId: 'prod_sword_01',
        status: 'COMPLETED',
      };

      mockPaymentServiceClient.createPayment.mockReturnValue(of(expectedReply));

      const response = await controller.createPayment({ session: mockSession }, dto);

      expect(mockPaymentServiceClient.createPayment).toHaveBeenCalledWith(
        {
          accountId: 42,
          amount: 10000,
          currency: 'KRW',
          productId: 'prod_sword_01',
          idempotencyKey: 'idem-123',
        },
        expect.anything(),
      );
      expect((response as any).code).toBe(0);
      expect((response as any).data).toEqual(expectedReply);
      expect((response as any).data.productId).toBe('prod_sword_01');
      expect((response as any).data.accountId).toBe(42);
    });
  });

  describe('getPayment', () => {
    it('결제 단건 조회 시 gRPC 응답의 productId와 accountId를 포함하여 ResponseEntity로 반환해야 한다', async () => {
      const expectedReply: PaymentReply = {
        paymentId: 1,
        accountId: 42,
        amount: 15000,
        currency: 'KRW',
        productId: 'prod_shield_01',
        status: 'COMPLETED',
      };

      mockPaymentServiceClient.getPayment.mockReturnValue(of(expectedReply));

      const response = await controller.getPayment({ session: mockSession }, 1);

      expect(mockPaymentServiceClient.getPayment).toHaveBeenCalledWith(
        { paymentId: 1, accountId: 42 },
        expect.anything(),
      );
      expect((response as any).code).toBe(0);
      expect((response as any).data).toEqual(expectedReply);
      expect((response as any).data.productId).toBe('prod_shield_01');
      expect((response as any).data.accountId).toBe(42);
    });
  });

  describe('listPayments', () => {
    it('내 결제 목록 조회 시 payments 목록 내 각 아이템에 productId와 accountId가 포함되어 반환되어야 한다', async () => {
      const expectedListResponse: ListPaymentsResponse = {
        payments: [
          {
            paymentId: 1,
            accountId: 42,
            amount: 10000,
            currency: 'KRW',
            productId: 'prod_sword_01',
            status: 'COMPLETED',
          },
        ],
        page: 1,
        take: 20,
        itemCount: 1,
        pageCount: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      };

      mockPaymentServiceClient.listPayments.mockReturnValue(of(expectedListResponse));

      const response = await controller.listPayments({ session: mockSession }, 1, 20);

      expect(mockPaymentServiceClient.listPayments).toHaveBeenCalledWith(
        { accountId: 42, page: 1, take: 20 },
        expect.anything(),
      );
      expect((response as any).code).toBe(0);
      expect((response as any).data.payments[0].productId).toBe('prod_sword_01');
      expect((response as any).data.payments[0].accountId).toBe(42);
    });
  });
});
