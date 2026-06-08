import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoClient } from 'mongodb';
import { LlmModule } from '@libs/llm';
import { IngestDocumentUseCase } from './application/ingest-document.use-case';
import { DocumentRepository } from './domain/repository/document.repository';
import { VectorStorePort } from './domain/port/vector-store.port';
import { DocumentRepositoryImpl } from './infrastructure/persistence/document.repository-impl';
import { MongoDBVectorAdapter } from './infrastructure/vector/mongodb-vector.adapter';
import { KnowledgeController } from './presentation/knowledge.controller';

@Module({
  imports: [LlmModule.forRootAsync()],
  controllers: [KnowledgeController],
  providers: [
    IngestDocumentUseCase,
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
  exports: [VectorStorePort],
})
export class KnowledgeModule {}
