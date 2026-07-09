import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { initOtelGenai } from '@libs/common/observability/otel-genai.config';
import { AiModule } from './ai.module';

async function bootstrap() {
  initOtelGenai();
  const app = await NestFactory.create(AiModule);
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [
      'http://localhost:3000',
      'http://localhost:5175',
    ],
    credentials: true,
    exposedHeaders: ['X-Session-Id'],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI Service')
    .setDescription('RAG 기반 Q&A 서비스 API')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup(
    'api',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const port = process.env.AI_SERVICE_PORT ?? 3004;
  await app.listen(port);
  logger.log(`AI Service running on port ${port}`);
}

bootstrap();
