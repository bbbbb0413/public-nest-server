import { Observable } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';

export interface CreatePaymentRequest {
  accountId: number;
  amount: number;
  currency: string;
  productId: string;
}

export interface GetPaymentRequest {
  paymentId: number;
}

export interface PaymentReply {
  id: number;
  amount: number;
  currency: string;
  status: string;
}

export interface PaymentServiceClient {
  createPayment(request: CreatePaymentRequest, metadata?: Metadata): Observable<PaymentReply>;
  getPayment(request: GetPaymentRequest, metadata?: Metadata): Observable<PaymentReply>;
}

export interface PaymentServiceController {
  createPayment(
    request: CreatePaymentRequest,
    metadata: Metadata,
  ): Promise<PaymentReply> | Observable<PaymentReply> | PaymentReply;

  getPayment(
    request: GetPaymentRequest,
    metadata: Metadata,
  ): Promise<PaymentReply> | Observable<PaymentReply> | PaymentReply;
}
