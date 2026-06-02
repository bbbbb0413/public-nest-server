import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { Metadata, status } from '@grpc/grpc-js';
import { CreatePaymentRequest, GetPaymentRequest, PaymentReply, PaymentServiceController } from '@libs/rpc';
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
    if (!payment) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Payment with ID ${request.paymentId} not found`,
      });
    }
    return PaymentGrpcMapper.toReply(payment);
  }
}
