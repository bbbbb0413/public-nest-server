import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { MongoClient } from 'mongodb';
import { RagasEvalService } from './application/ragas-eval.service';
import { RagasEvalConsumer } from './infrastructure/queue/ragas-eval.consumer';
import { RagasEvaluationRepositoryImpl } from './infrastructure/persistence/ragas-evaluation.repository-impl';
import { ObservabilityController } from './observability.controller';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({ name: 'ragas-eval' }, { name: 'ingest' }),
  ],
  controllers: [ObservabilityController],
  providers: [
    RagasEvalService,
    RagasEvalConsumer,
    {
      provide: 'MONGO_CLIENT_OBSERVABILITY',
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<MongoClient> => {
        const client = new MongoClient(config.getOrThrow('MONGODB_VECTOR_URI'));
        await client.connect();
        return client;
      },
    },
    {
      provide: RagasEvaluationRepositoryImpl,
      inject: ['MONGO_CLIENT_OBSERVABILITY', ConfigService],
      useFactory: (client: MongoClient, config: ConfigService) =>
        new RagasEvaluationRepositoryImpl(client, config),
    },
  ],
  exports: [RagasEvalService],
})
export class ObservabilityModule {}
