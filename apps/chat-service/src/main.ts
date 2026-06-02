import { NestFactory } from '@nestjs/core';
import { ChatModule } from './chat.module';
import { Logger } from '@nestjs/common';
import { getGrpcOptions, GRPC_PACKAGES } from '@libs/rpc';

async function bootstrap() {
  const grpcUrl = process.env.CHAT_GRPC_URL || '0.0.0.0:50053';
  const app = await NestFactory.createMicroservice(
    ChatModule,
    getGrpcOptions(grpcUrl, GRPC_PACKAGES.CHAT, 'chat.proto'),
  );

  await app.listen();
  Logger.log(`Chat Service gRPC is running on ${grpcUrl}`);
}
bootstrap();
