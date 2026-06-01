import { NestFactory } from '@nestjs/core';
import { PaymentModule } from './payment.module';
import { Transport } from '@nestjs/microservices';
import { PaymentServer } from './payment.server';

async function server(): Promise<void> {
  const redisHost = process.env.REDIS_DB_HOST || 'localhost';
  const redisPort = process.env.REDIS_DB_PORT || 6379;
  const microservice = await NestFactory.createMicroservice(PaymentModule, {
    transport: Transport.REDIS,
    options: {
      url: `redis://${redisHost}:${redisPort}`,
      retryAttempts: 5,
      retryDelay: 3000,
    },
  });

  await microservice.listen();

  const app = await NestFactory.create(PaymentModule);
  const server = new PaymentServer(app);

  server.init();
  await server.run();
}

void server();
