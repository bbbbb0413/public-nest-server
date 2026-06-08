import { Module } from '@nestjs/common';
import { LlmModule } from '@libs/llm';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AskUseCase } from './application/ask.use-case';
import { QaController } from './presentation/qa.controller';

@Module({
  imports: [LlmModule.forRootAsync(), KnowledgeModule],
  controllers: [QaController],
  providers: [AskUseCase],
})
export class QaModule {}
