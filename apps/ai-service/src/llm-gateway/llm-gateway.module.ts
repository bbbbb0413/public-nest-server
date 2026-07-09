import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongoClient } from 'mongodb';
import { LlmModule } from '@libs/llm';
import { LlmGatewayService } from './application/llm-gateway.service';
import { LlmRoutingService } from './application/llm-routing.service';
import { FallbackService } from './application/fallback.service';
import { CostTrackingService } from './application/cost-tracking.service';
import { CircuitBreakerPort } from './domain/port/circuit-breaker.port';
import { LlmCostLogRepository } from './domain/repository/llm-cost-log.repository';
import { CircuitBreakerAdapter } from './infrastructure/circuit-breaker.adapter';
import { LlmCostLogRepositoryImpl } from './infrastructure/persistence/llm-cost-log.repository-impl';
import { LlmCostController } from './presentation/llm-cost.controller';
import { LangSmithTracingService } from './application/langsmith-tracing.service';

@Module({
  imports: [ConfigModule, LlmModule.forRootAsync()],
  controllers: [LlmCostController],
  providers: [
    LlmGatewayService,
    LangSmithTracingService,
    LlmRoutingService,
    FallbackService,
    CostTrackingService,
    { provide: CircuitBreakerPort, useClass: CircuitBreakerAdapter },
    {
      provide: 'MONGO_CLIENT_GATEWAY',
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<MongoClient> => {
        const client = new MongoClient(config.getOrThrow('MONGODB_VECTOR_URI'));
        await client.connect();
        return client;
      },
    },
    {
      provide: LlmCostLogRepository,
      inject: ['MONGO_CLIENT_GATEWAY', ConfigService],
      useFactory: (client: MongoClient, config: ConfigService) =>
        new LlmCostLogRepositoryImpl(client, config),
    },
  ],
  exports: [LlmGatewayService],
})
export class LlmGatewayModule {}
