import { NestFactory } from '@nestjs/core';
import { GatewayModule } from './gateway.module';
import { GatewayServer } from './gateway.server';
import { AuthenticatedRedisIoAdapter } from '@libs/common/adapter/authenticated-redis-io.adapter';

async function server(): Promise<void> {
  const app = await NestFactory.create(GatewayModule);

  const redisIoAdapter = new AuthenticatedRedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const server = new GatewayServer(app);

  server.init();
  await server.run();
}

void server();
