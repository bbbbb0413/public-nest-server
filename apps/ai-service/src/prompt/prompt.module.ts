import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoClient } from 'mongodb';
import { CreatePromptUseCase } from './application/create-prompt.use-case';
import { ActivatePromptUseCase } from './application/activate-prompt.use-case';
import { GetActivePromptUseCase } from './application/get-active-prompt.use-case';
import { PromptTemplateRepository } from './domain/repository/prompt-template.repository';
import { PromptTemplateRepositoryImpl } from './infrastructure/persistence/prompt-template.repository-impl';
import { PromptController } from './presentation/prompt.controller';

@Module({
  controllers: [PromptController],
  providers: [
    CreatePromptUseCase,
    ActivatePromptUseCase,
    GetActivePromptUseCase,
    {
      provide: 'PROMPT_MONGO_CLIENT',
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<MongoClient> => {
        const client = new MongoClient(config.getOrThrow('MONGODB_VECTOR_URI'));
        await client.connect();
        return client;
      },
    },
    {
      provide: PromptTemplateRepository,
      inject: ['PROMPT_MONGO_CLIENT', ConfigService],
      useFactory: (client: MongoClient, config: ConfigService) =>
        new PromptTemplateRepositoryImpl(
          client,
          config.get('MONGODB_DB_NAME', 'ai_service'),
        ),
    },
  ],
  exports: [GetActivePromptUseCase, PromptTemplateRepository],
})
export class PromptModule {}
