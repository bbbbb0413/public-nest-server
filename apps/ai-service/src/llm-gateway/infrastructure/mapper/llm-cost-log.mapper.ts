import { LlmCostLog } from '../../domain/repository/llm-cost-log.repository';
import { LlmCostLogOrmEntity } from '../orm/llm-cost-log.orm-entity';

export class LlmCostLogMapper {
  static toOrmEntity(domain: LlmCostLog): LlmCostLogOrmEntity {
    const orm = new LlmCostLogOrmEntity();
    orm.model = domain.model;
    orm.feature = domain.feature;
    orm.tenant = domain.tenant;
    orm.promptTokens = domain.promptTokens;
    orm.completionTokens = domain.completionTokens;
    orm.costUsd = domain.costUsd;
    orm.fallbackUsed = domain.fallbackUsed;
    orm.attemptedModels = domain.attemptedModels;
    orm.createdAt = domain.createdAt;
    return orm;
  }
}
