import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenUsage } from '../domain/vo/token-usage.vo';
import {
  ILlmCostLogRepository,
  LlmCostLogRepository,
} from '../domain/repository/llm-cost-log.repository';

interface ModelCostEntry {
  prompt: number;
  completion: number;
}

interface TrackParams {
  model: string;
  feature: string;
  tenant: string;
  usage: TokenUsage;
  fallbackUsed: boolean;
  attemptedModels: string[];
}

@Injectable()
export class CostTrackingService {
  private readonly logger = new Logger(CostTrackingService.name);
  private readonly costTable: Record<string, ModelCostEntry>;

  constructor(
    @Inject(LlmCostLogRepository)
    private readonly repo: ILlmCostLogRepository,
    private readonly configService: ConfigService,
  ) {
    const raw = this.configService.get<string>('MODEL_COST_TABLE');
    this.costTable = raw
      ? (JSON.parse(raw) as Record<string, ModelCostEntry>)
      : {};
  }

  async track(params: TrackParams): Promise<void> {
    const { model, feature, tenant, usage, fallbackUsed, attemptedModels } =
      params;
    const costUsd = this.calcCost(model, usage);

    try {
      await this.repo.persist({
        model,
        feature,
        tenant,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        costUsd,
        fallbackUsed,
        attemptedModels,
        createdAt: new Date(),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      this.logger.error(`비용 로그 저장 실패: ${msg}`);
    }
  }

  private calcCost(model: string, usage: TokenUsage): number {
    const entry = this.costTable[model];
    if (!entry) return 0;
    return (
      (usage.promptTokens * entry.prompt +
        usage.completionTokens * entry.completion) /
      1_000_000
    );
  }
}
