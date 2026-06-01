import { NestFactory } from '@nestjs/core';
import { IdentityModule } from './identity.module';
import { IdentityServer } from './identity.server';
import { AuthenticatedRedisIoAdapter } from '@libs/common/adapter/authenticated-redis-io.adapter';

async function server(): Promise<void> {
  const app = await NestFactory.create(IdentityModule);
  const redisIoAdapter = new AuthenticatedRedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();

  // adapter 는 한개만 달수 있음
  app.useWebSocketAdapter(redisIoAdapter);

  const server = new IdentityServer(app);

  server.init();
  await server.run();
}

void server();
