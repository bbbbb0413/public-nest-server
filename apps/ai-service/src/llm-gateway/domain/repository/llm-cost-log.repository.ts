export interface LlmCostLog {
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

export interface ILlmCostLogRepository {
  persist(log: LlmCostLog): Promise<void>;
  sumByModel(
    from: Date,
    to: Date,
  ): Promise<Array<{ model: string; totalCostUsd: number }>>;
}

export const LlmCostLogRepository = Symbol('LlmCostLogRepository');
