import { Test, TestingModule } from '@nestjs/testing';
import { PaymentGrpcController } from './payment.grpc-controller';
import { CreatePaymentUseCase } from '../application/create-payment.use-case';
import { IPaymentRepository } from '../domain/repository/payment.repository';
import { Payment } from '../domain/model/payment';
import { Metadata } from '@grpc/grpc-js';
import { CreatePaymentRequest, GetPaymentRequest, PaymentReply } from '@libs/rpc';
import { RpcException } from '@nestjs/microservices';

const mockCreatePaymentUseCase = () => ({
  execute: jest.fn(),
});

const mockPaymentRepository = () => ({
  persist: jest.fn(),
  findPaymentById: jest.fn(),
  findAllAndCount: jest.fn(),
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
      };
      const metadata = new Metadata();

      const reply = (await controller.createPayment(request, metadata)) as PaymentReply;

      expect(createPaymentUseCase.execute).toHaveBeenCalled();
      expect(reply.id).toBe(1);
      expect(reply.amount).toBe(10000);
      expect(reply.currency).toBe('KRW');
    });
  });

  describe('getPayment', () => {
    it('결제가 존재하면 gRPC PaymentReply를 반환해야 한다', async () => {
      const fixture = buildPaymentFixture();
      paymentRepository.findPaymentById.mockResolvedValue(fixture);

      const request: GetPaymentRequest = {
        paymentId: 1,
      };
      const metadata = new Metadata();

      const reply = (await controller.getPayment(request, metadata)) as PaymentReply;

      expect(paymentRepository.findPaymentById).toHaveBeenCalledWith(1);
      expect(reply.id).toBe(1);
      expect(reply.status).toBe('COMPLETED'); // default status
    });

    it('결제가 존재하지 않으면 RpcException(NOT_FOUND)을 발생시켜야 한다', async () => {
      paymentRepository.findPaymentById.mockResolvedValue(null);

      const request: GetPaymentRequest = {
        paymentId: 999,
      };
      const metadata = new Metadata();

      await expect(controller.getPayment(request, metadata)).rejects.toThrow(RpcException);
    });
  });
});
