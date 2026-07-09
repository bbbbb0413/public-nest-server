export class LlmCostLogOrmEntity {
  model: string;
  feature: string;
  tenant: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  fallbackUsed: boolean;
  attemptedModels: string[];
  createdAt: Date;
}
