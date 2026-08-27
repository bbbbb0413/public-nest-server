import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AdminServerModule } from './admin-server.module';
import { getGrpcOptions, GRPC_PACKAGES } from '@libs/rpc';

async function bootstrap() {
  const grpcUrl = process.env.AUTH_GRPC_URL || '0.0.0.0:50054';
  const app = await NestFactory.createMicroservice(
    AdminServerModule,
    getGrpcOptions(grpcUrl, GRPC_PACKAGES.AUTH, 'auth.proto'),
  );

  await app.listen();
  Logger.log(`Admin server gRPC is running on ${grpcUrl} (+ mail queue consumer)`);
}

bootstrap();
