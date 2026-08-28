import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { Metadata, status } from '@grpc/grpc-js';
import {
  CreatePaymentRequest,
  GetPaymentRequest,
  ListPaymentsRequest,
  ListPaymentsResponse,
  PaymentReply,
  PaymentServiceController,
} from '@libs/rpc';
import { CreatePaymentUseCase } from '../application/create-payment.use-case';
import { IPaymentRepository } from '../domain/repository/payment.repository';
import { PaymentGrpcMapper } from './payment.grpc-mapper';

@Controller()
export class PaymentGrpcController implements PaymentServiceController {
  constructor(
    private readonly createPaymentUseCase: CreatePaymentUseCase,
    @Inject(IPaymentRepository)
    private readonly paymentRepository: IPaymentRepository,
  ) {}

  @GrpcMethod('PaymentService', 'CreatePayment')
  async createPayment(
    request: CreatePaymentRequest,
    metadata: Metadata,
  ): Promise<PaymentReply> {
    const command = PaymentGrpcMapper.toCommand(request);
    const payment = await this.createPaymentUseCase.execute(command);
    return PaymentGrpcMapper.toReply(payment);
  }

  @GrpcMethod('PaymentService', 'GetPayment')
  async getPayment(
    request: GetPaymentRequest,
    metadata: Metadata,
  ): Promise<PaymentReply> {
    const payment = await this.paymentRepository.findPaymentById(request.paymentId);
    // 소유자가 아닌 결제는 존재 여부를 노출하지 않기 위해 미존재와 동일하게 NOT_FOUND로 응답한다.
    if (!payment || payment.userId !== request.accountId) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Payment with ID ${request.paymentId} not found`,
      });
    }
    return PaymentGrpcMapper.toReply(payment);
  }

  @GrpcMethod('PaymentService', 'ListPayments')
  async listPayments(
    request: ListPaymentsRequest,
    metadata: Metadata,
  ): Promise<ListPaymentsResponse> {
    const page = request.page > 0 ? request.page : 1;
    const take = request.take > 0 ? request.take : 20;
    const [payments, itemCount] = await this.paymentRepository.findPaymentsByUserId(
      request.accountId,
      take,
      (page - 1) * take,
    );
    const pageCount = Math.max(Math.ceil(itemCount / take), 1);

    return {
      payments: payments.map(PaymentGrpcMapper.toReply),
      page,
      take,
      itemCount,
      pageCount,
      hasPreviousPage: page > 1,
      hasNextPage: page < pageCount,
    };
  }
}
