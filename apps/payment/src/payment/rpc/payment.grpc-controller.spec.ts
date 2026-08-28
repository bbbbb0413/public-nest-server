import { Test, TestingModule } from '@nestjs/testing';
import { PaymentGrpcController } from './payment.grpc-controller';
import { CreatePaymentUseCase } from '../application/create-payment.use-case';
import { IPaymentRepository } from '../domain/repository/payment.repository';
import { Payment } from '../domain/model/payment';
import { PaymentStatus } from '../domain/model/payment-status.enum';
import { Metadata } from '@grpc/grpc-js';
import { CreatePaymentRequest, GetPaymentRequest, ListPaymentsRequest, PaymentReply } from '@libs/rpc';
import { RpcException } from '@nestjs/microservices';

const mockCreatePaymentUseCase = () => ({
  execute: jest.fn(),
});

const mockPaymentRepository = () => ({
  persist: jest.fn(),
  findPaymentById: jest.fn(),
  findAllAndCount: jest.fn(),
  findPaymentsByUserId: jest.fn(),
});

const buildPaymentFixture = (): Payment =>
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

describe('PaymentGrpcController', () => {
  let controller: PaymentGrpcController;
  let createPaymentUseCase: ReturnType<typeof mockCreatePaymentUseCase>;
  let paymentRepository: ReturnType<typeof mockPaymentRepository>;

  beforeEach(async () => {
    createPaymentUseCase = mockCreatePaymentUseCase();
    paymentRepository = mockPaymentRepository();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentGrpcController],
      providers: [
        { provide: CreatePaymentUseCase, useValue: createPaymentUseCase },
        { provide: IPaymentRepository, useValue: paymentRepository },
      ],
    }).compile();

    controller = module.get<PaymentGrpcController>(PaymentGrpcController);
  });

  describe('createPayment', () => {
    it('gRPC 결제 생성 요청을 받아 UseCase를 호출하고 결과를 반환해야 한다', async () => {
      const fixture = buildPaymentFixture();
      createPaymentUseCase.execute.mockResolvedValue(fixture);

      const request: CreatePaymentRequest = {
        accountId: 100,
        amount: 10000,
        currency: 'KRW',
        productId: 'product-001',
        idempotencyKey: 'idem-key-1',
      };
      const metadata = new Metadata();

      const reply = (await controller.createPayment(request, metadata)) as PaymentReply;

      expect(createPaymentUseCase.execute).toHaveBeenCalled();
      expect(reply.paymentId).toBe(1);
      expect(reply.amount).toBe(10000);
      expect(reply.currency).toBe('KRW');
    });
  });

  describe('getPayment', () => {
    it('본인 결제이면 gRPC PaymentReply를 반환해야 한다', async () => {
      const fixture = buildPaymentFixture();
      paymentRepository.findPaymentById.mockResolvedValue(fixture);

      const request: GetPaymentRequest = {
        paymentId: 1,
        accountId: 100,
      };
      const metadata = new Metadata();

      const reply = (await controller.getPayment(request, metadata)) as PaymentReply;

      expect(paymentRepository.findPaymentById).toHaveBeenCalledWith(1);
      expect(reply.paymentId).toBe(1);
      expect(reply.status).toBe(PaymentStatus.COMPLETED);
    });

    it('결제가 존재하지 않으면 RpcException(NOT_FOUND)을 발생시켜야 한다', async () => {
      paymentRepository.findPaymentById.mockResolvedValue(null);

      const request: GetPaymentRequest = {
        paymentId: 999,
        accountId: 100,
      };
      const metadata = new Metadata();

      await expect(controller.getPayment(request, metadata)).rejects.toThrow(RpcException);
    });

    it('다른 사용자의 결제를 조회하면 RpcException(NOT_FOUND)을 발생시켜야 한다 (IDOR 방지)', async () => {
      const fixture = buildPaymentFixture(); // userId: 100
      paymentRepository.findPaymentById.mockResolvedValue(fixture);

      const request: GetPaymentRequest = {
        paymentId: 1,
        accountId: 999, // 결제 소유자가 아닌 다른 사용자
      };
      const metadata = new Metadata();

      await expect(controller.getPayment(request, metadata)).rejects.toThrow(RpcException);
    });
  });

  describe('listPayments', () => {
    it('요청자 소유의 결제만 페이지네이션해 반환해야 한다', async () => {
      const fixture = buildPaymentFixture();
      paymentRepository.findPaymentsByUserId.mockResolvedValue([[fixture], 1]);

      const request: ListPaymentsRequest = {
        accountId: 100,
        page: 1,
        take: 20,
      };
      const metadata = new Metadata();

      const reply = await controller.listPayments(request, metadata);

      expect(paymentRepository.findPaymentsByUserId).toHaveBeenCalledWith(100, 20, 0);
      expect(reply.payments).toHaveLength(1);
      expect(reply.payments[0].paymentId).toBe(1);
      expect(reply.itemCount).toBe(1);
      expect(reply.pageCount).toBe(1);
      expect(reply.hasNextPage).toBe(false);
      expect(reply.hasPreviousPage).toBe(false);
    });

    it('page/take가 0 이하로 오면 기본값(1페이지, 20건)으로 보정해야 한다', async () => {
      paymentRepository.findPaymentsByUserId.mockResolvedValue([[], 0]);

      const request: ListPaymentsRequest = {
        accountId: 100,
        page: 0,
        take: 0,
      };
      const metadata = new Metadata();

      await controller.listPayments(request, metadata);

      expect(paymentRepository.findPaymentsByUserId).toHaveBeenCalledWith(100, 20, 0);
    });
  });
});
