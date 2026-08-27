import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiKafkaClientModule } from './kafka/ai-kafka-client.module';
import { AiKafkaProducerService } from './kafka/ai-kafka-producer.service';
import { JobStoreService } from './job/job-store.service';
import { JobController } from './job/job.controller';
import { RedisStreamsRelayService } from './stream/redis-streams-relay.service';
import { JobStreamController } from './stream/job-stream.controller';
import { AiServicePyHttpService } from './proxy/ai-service-py-http.service';
import { PromptProxyController } from './proxy/prompt-proxy.controller';
import { MyPromptProxyController } from './proxy/my-prompt-proxy.controller';
import { LlmGatewayProxyController } from './proxy/llm-gateway-proxy.controller';
import { ObservabilityProxyController } from './proxy/observability-proxy.controller';
import { RagSessionProxyController } from './proxy/rag-session-proxy.controller';
import { KnowledgeProxyController } from './proxy/knowledge-proxy.controller';
import { KnowledgeFileStagingService } from './knowledge/knowledge-file-staging.service';
import { KnowledgeJobController } from './knowledge/knowledge-job.controller';

@Module({
  imports: [AiKafkaClientModule, HttpModule],
  controllers: [
    JobController,
    JobStreamController,
    PromptProxyController,
    MyPromptProxyController,
    LlmGatewayProxyController,
    ObservabilityProxyController,
    RagSessionProxyController,
    KnowledgeProxyController,
    KnowledgeJobController,
  ],
  providers: [
    AiKafkaProducerService,
    JobStoreService,
    RedisStreamsRelayService,
    AiServicePyHttpService,
    KnowledgeFileStagingService,
  ],
})
export class AiGatewayModule {}
