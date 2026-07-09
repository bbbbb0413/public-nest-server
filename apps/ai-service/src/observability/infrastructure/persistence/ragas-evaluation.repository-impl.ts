import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Collection, MongoClient } from 'mongodb';

export interface RagasEvaluationDoc {
  traceId: string;
  question: string;
  faithfulness: number;
  answerRelevancy: number;
  contextPrecision: number;
  sampledAt: Date;
}

@Injectable()
export class RagasEvaluationRepositoryImpl {
  private readonly logger = new Logger(RagasEvaluationRepositoryImpl.name);
  private readonly collection: Collection<RagasEvaluationDoc>;

  constructor(
    @Inject('MONGO_CLIENT_OBSERVABILITY') client: MongoClient,
    configService: ConfigService,
  ) {
    const dbName = configService.get<string>('MONGODB_DB_NAME') ?? 'ai_service';
    this.collection = client
      .db(dbName)
      .collection<RagasEvaluationDoc>('ragas_evaluations');
  }

  async persist(doc: RagasEvaluationDoc): Promise<void> {
    await this.collection.insertOne(doc);
  }

  async findRecent(limit: number): Promise<RagasEvaluationDoc[]> {
    return this.collection
      .find({}, { projection: { _id: 0 } })
      .sort({ sampledAt: -1 })
      .limit(limit)
      .toArray();
  }
}
