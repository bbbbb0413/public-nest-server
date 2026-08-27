import { NestFactory } from '@nestjs/core';
import { IdentityModule } from './identity.module';
import { IdentityServer } from './identity.server';
import { getGrpcOptions, GRPC_PACKAGES } from '@libs/rpc';

async function server(): Promise<void> {
  const app = await NestFactory.create(IdentityModule);

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [
      'http://localhost:5175',
    ],
    credentials: true,
  });

  const grpcUrl = process.env.IDENTITY_GRPC_URL || '0.0.0.0:50051';
  app.connectMicroservice(
    getGrpcOptions(grpcUrl, GRPC_PACKAGES.IDENTITY, 'identity.proto'),
  );

  await app.startAllMicroservices();

  const server = new IdentityServer(app);

  server.init();
  await server.run();
}

void server();
