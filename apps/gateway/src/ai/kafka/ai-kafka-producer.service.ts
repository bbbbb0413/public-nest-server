import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { AI_KAFKA_CLIENT } from './ai-kafka-client.module';

export const AI_RAG_ASK_REQUESTED_TOPIC = 'ai.rag.ask.requested';
export const AI_KNOWLEDGE_INGEST_REQUESTED_TOPIC =
  'ai.knowledge.ingest.requested';

export interface ConversationTurnPayload {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskJobRequestedPayload {
  jobId: string;
  userId: string;
  question: string;
  topK?: number;
  useHyde?: boolean;
  sessionId?: string;
  conversationHistory?: ConversationTurnPayload[];
}

export interface KnowledgeIngestRequestedPayload {
  jobId: string;
  fileName: string;
  mimeType: string;
}

@Injectable()
export class AiKafkaProducerService implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(AI_KAFKA_CLIENT) private readonly client: ClientKafka) {}

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  async publishAskRequested(payload: AskJobRequestedPayload): Promise<void> {
    await firstValueFrom(
      this.client.emit(AI_RAG_ASK_REQUESTED_TOPIC, {
        key: payload.jobId,
        value: JSON.stringify(payload),
      }),
    );
  }

  async publishKnowledgeIngestRequested(
    payload: KnowledgeIngestRequestedPayload,
  ): Promise<void> {
    await firstValueFrom(
      this.client.emit(AI_KNOWLEDGE_INGEST_REQUESTED_TOPIC, {
        key: payload.jobId,
        value: JSON.stringify(payload),
      }),
    );
  }
}
