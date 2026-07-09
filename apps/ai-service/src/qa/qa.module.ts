import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmModule } from '@libs/llm';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { LlmGatewayModule } from '../llm-gateway/llm-gateway.module';
import { PromptModule } from '../prompt/prompt.module';
import { AskUseCase } from './application/ask.use-case';
import { AgenticAskUseCase } from './application/agentic-ask.use-case';
import { HybridSearchUseCase } from './application/hybrid-search.use-case';
import { RrfFusionService } from './application/rrf-fusion.service';
import { HydeService } from './application/hyde.service';
import { ConversationalQueryRewriter } from './application/conversational-query-rewriter.service';
import { QueryDecomposer } from './application/query-decomposer.service';
import { CritiqueGeneratorService } from './application/critique-generator.service';
import { QueryRefinerService } from './application/query-refiner.service';
import { QueryComplexityRouter } from './application/query-complexity-router';
import { GetSessionsUseCase } from './application/get-sessions.use-case';
import { GetSessionUseCase } from './application/get-session.use-case';
import { DeleteSessionUseCase } from './application/delete-session.use-case';
import { LlmCachePort } from './domain/port/llm-cache.port';
import { SemanticCachePort } from './domain/port/semantic-cache.port';
import { LexicalSearchPort } from './domain/port/lexical-search.port';
import { RerankerPort } from './domain/port/reranker.port';
import { ConversationSessionRepository } from './domain/repository/conversation-session.repository';
import { RedisLlmCacheAdapter } from './infrastructure/cache/redis-llm-cache.adapter';
import { RedisSemanticCacheAdapter } from './infrastructure/cache/redis-semantic-cache.adapter';
import { MongoTextSearchAdapter } from './infrastructure/search/mongo-text-search.adapter';
import { HttpRerankerAdapter } from './infrastructure/search/http-reranker.adapter';
import { ConversationSessionRepositoryImpl } from './infrastructure/persistence/conversation-session.repository-impl';
import { QaController } from './presentation/qa.controller';
import { RagContentValidator } from './application/filter/rag-content-validator';
import { SecretPiiScanner } from './application/filter/secret-pii-scanner';
import { PromptInjectionGuard } from './presentation/guard/prompt-injection.guard';
import { ExfiltrationInterceptor } from './presentation/interceptor/exfiltration.interceptor';

@Module({
  imports: [
    ConfigModule,
    LlmModule.forRootAsync(),
    LlmGatewayModule,
    KnowledgeModule,
    PromptModule,
  ],
  controllers: [QaController],
  providers: [
    AskUseCase,
    AgenticAskUseCase,
    HybridSearchUseCase,
    RrfFusionService,
    HydeService,
    ConversationalQueryRewriter,
    QueryDecomposer,
    CritiqueGeneratorService,
    QueryRefinerService,
    QueryComplexityRouter,
    GetSessionsUseCase,
    GetSessionUseCase,
    DeleteSessionUseCase,
    { provide: LlmCachePort, useClass: RedisLlmCacheAdapter },
    { provide: SemanticCachePort, useClass: RedisSemanticCacheAdapter },
    { provide: LexicalSearchPort, useClass: MongoTextSearchAdapter },
    { provide: RerankerPort, useClass: HttpRerankerAdapter },
    {
      provide: ConversationSessionRepository,
      useClass: ConversationSessionRepositoryImpl,
    },
    RagContentValidator,
    SecretPiiScanner,
    PromptInjectionGuard,
    ExfiltrationInterceptor,
  ],
})
export class QaModule {}
