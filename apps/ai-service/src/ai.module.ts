import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { BullModule } from '@nestjs/bull';
import { OtelGenaiInterceptor } from '@libs/common/observability/otel-genai.interceptor';
import { AiServerConfig } from './config/ai-server-config';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { QaModule } from './qa/qa.module';
import { PromptModule } from './prompt/prompt.module';
import { ObservabilityModule } from './observability/observability.module';

@Module({
  imports: [
    AiServerConfig,
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_DB_HOST,
        port: Number(process.env.REDIS_DB_PORT),
      },
    }),
    KnowledgeModule,
    QaModule,
    PromptModule,
    ObservabilityModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: OtelGenaiInterceptor }],
})
export class AiModule {}
