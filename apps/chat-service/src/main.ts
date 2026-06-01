import { NestFactory } from '@nestjs/core';
import { ChatModule } from './chat.module';
import { Logger } from '@nestjs/common';
import { AuthenticatedRedisIoAdapter } from '@libs/common/adapter/authenticated-redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(ChatModule);
  
  const redisIoAdapter = new AuthenticatedRedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);
  
  const port = process.env.PORT || 3007;
  await app.listen(port);
  Logger.log(`Chat Service is running on port ${port}`);
}
bootstrap();
