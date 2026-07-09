import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Collection, MongoClient } from 'mongodb';
import {
  ILlmCostLogRepository,
  LlmCostLog,
} from '../../domain/repository/llm-cost-log.repository';
import { LlmCostLogMapper } from '../mapper/llm-cost-log.mapper';

@Injectable()
export class LlmCostLogRepositoryImpl implements ILlmCostLogRepository {
  private readonly logger = new Logger(LlmCostLogRepositoryImpl.name);
  private readonly collection: Collection;

  constructor(
    @Inject('MONGO_CLIENT') client: MongoClient,
    private readonly configService: ConfigService,
  ) {
    const dbName =
      this.configService.get<string>('MONGODB_DB_NAME') ?? 'ai_service';
    this.collection = client.db(dbName).collection('llm_cost_logs');
  }

  async persist(log: LlmCostLog): Promise<void> {
    const orm = LlmCostLogMapper.toOrmEntity(log);
    await this.collection.insertOne(orm);
  }

  async sumByModel(
    from: Date,
    to: Date,
  ): Promise<Array<{ model: string; totalCostUsd: number }>> {
    const results = await this.collection
      .aggregate<{
        _id: string;
        totalCostUsd: number;
      }>([{ $match: { createdAt: { $gte: from, $lte: to } } }, { $group: { _id: '$model', totalCostUsd: { $sum: '$costUsd' } } }, { $sort: { totalCostUsd: -1 } }])
      .toArray();

    return results.map((r) => ({ model: r._id, totalCostUsd: r.totalCostUsd }));
  }
}
