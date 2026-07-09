export interface ILlmCachePort {
  get(key: string): Promise<string | null>;
  setWithTtl(key: string, value: string, ttlSeconds: number): Promise<void>;
  invalidate(key: string): Promise<void>;
}

export const LlmCachePort = Symbol('LlmCachePort');
