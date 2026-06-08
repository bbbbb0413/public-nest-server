import { Module } from '@nestjs/common';
import { AiServerConfig } from './config/ai-server-config';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { QaModule } from './qa/qa.module';

@Module({
  imports: [AiServerConfig, KnowledgeModule, QaModule],
})
export class AiModule {}
