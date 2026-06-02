import { NestFactory } from '@nestjs/core';
import { PaymentModule } from './payment.module';
import { PaymentServer } from './payment.server';
import { getGrpcOptions, GRPC_PACKAGES } from '@libs/rpc';

async function server(): Promise<void> {
  const app = await NestFactory.create(PaymentModule);

  const grpcUrl = process.env.PAYMENT_GRPC_URL || '0.0.0.0:50052';
  app.connectMicroservice(
    getGrpcOptions(grpcUrl, GRPC_PACKAGES.PAYMENT, 'payment.proto'),
  );

  await app.startAllMicroservices();

  const server = new PaymentServer(app);

  server.init();
  await server.run();
}

void server();
