import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AdminServerModule } from './admin-server.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(AdminServerModule);
  Logger.log('Admin server worker is running (mail queue consumer)');
}

bootstrap();
