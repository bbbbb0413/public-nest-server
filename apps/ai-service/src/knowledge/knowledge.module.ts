import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { MongoClient } from 'mongodb';
import { LlmModule } from '@libs/llm';
import { IngestDocumentUseCase } from './application/ingest-document.use-case';
import {
  IngestQueueService,
  INGEST_QUEUE,
} from './application/ingest-queue.service';
import { RagContentValidator } from '../qa/application/filter/rag-content-validator';
import { DocumentRepository } from './domain/repository/document.repository';
import { VectorStorePort } from './domain/port/vector-store.port';
import { DocumentRepositoryImpl } from './infrastructure/persistence/document.repository-impl';
import { MongoDBVectorAdapter } from './infrastructure/vector/mongodb-vector.adapter';
import { IngestConsumer } from './infrastructure/queue/ingest.consumer';
import { KnowledgeController } from './presentation/knowledge.controller';
import { AdminApiKeyGuard } from './presentation/guard/admin-api-key.guard';

@Module({
  imports: [
    LlmModule.forRootAsync(),
    BullModule.registerQueue({
      name: INGEST_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [KnowledgeController],
  providers: [
    AdminApiKeyGuard,
    IngestDocumentUseCase,
    IngestQueueService,
    IngestConsumer,
    RagContentValidator,
    {
      provide: 'MONGO_CLIENT',
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<MongoClient> => {
        const client = new MongoClient(config.getOrThrow('MONGODB_VECTOR_URI'));
        await client.connect();
        return client;
      },
    },
    {
      provide: DocumentRepository,
      inject: ['MONGO_CLIENT', ConfigService],
      useFactory: (client: MongoClient, config: ConfigService) =>
        new DocumentRepositoryImpl(
          client,
          config.get('MONGODB_DB_NAME', 'ai_service'),
        ),
    },
    {
      provide: VectorStorePort,
      inject: ['MONGO_CLIENT', ConfigService],
      useFactory: (client: MongoClient, config: ConfigService) =>
        new MongoDBVectorAdapter(
          client,
          config.get('MONGODB_DB_NAME', 'ai_service'),
        ),
    },
  ],
  exports: ['MONGO_CLIENT', VectorStorePort],
})
export class KnowledgeModule {}
