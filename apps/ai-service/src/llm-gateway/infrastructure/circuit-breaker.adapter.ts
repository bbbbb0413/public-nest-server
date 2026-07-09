import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AbstractRedisRepository } from '@libs/common/databases/redis/abstract-redis.repository';
import {
  CircuitBreakerState,
  CircuitBreakerSnapshot,
  BreakerStatus,
} from '../domain/model/circuit-breaker-state';
import { ICircuitBreakerPort } from '../domain/port/circuit-breaker.port';

const CIRCUIT_BREAKER_DB = 3;
const TTL_SECONDS = 3600;

@Injectable()
export class CircuitBreakerAdapter
  extends AbstractRedisRepository
  implements ICircuitBreakerPort, OnModuleInit
{
  protected readonly dbNumber = CIRCUIT_BREAKER_DB;
  private readonly logger = new Logger(CircuitBreakerAdapter.name);

  onModuleInit(): void {
    this.createRedisClient();
  }

  async canCall(model: string): Promise<boolean> {
    const state = await this.loadState(model);
    return state.canCall(Date.now());
  }

  async recordSuccess(model: string): Promise<void> {
    const state = await this.loadState(model);
    state.recordSuccess();
    await this.saveState(state);
  }

  async recordFailure(model: string): Promise<void> {
    const state = await this.loadState(model);
    state.recordFailure(Date.now());
    await this.saveState(state);
  }

  async getState(model: string): Promise<CircuitBreakerSnapshot> {
    const state = await this.loadState(model);
    return state.snapshot();
  }

  private async loadState(model: string): Promise<CircuitBreakerState> {
    try {
      const raw = await this.redis.hgetall(`cb:${model}`);
      if (!raw || !raw.status) {
        return CircuitBreakerState.create(model);
      }
      return CircuitBreakerState.restore({
        model,
        status: raw.status as BreakerStatus,
        failureCount: Number(raw.failureCount ?? 0),
        openedAt: raw.openedAt ? Number(raw.openedAt) : null,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      this.logger.error(`Circuit Breaker 상태 로드 실패(${model}): ${msg}`);
      return CircuitBreakerState.create(model);
    }
  }

  private async saveState(state: CircuitBreakerState): Promise<void> {
    const snap = state.snapshot();
    const key = `cb:${snap.model}`;
    await this.redis.hset(key, {
      status: snap.status,
      failureCount: String(snap.failureCount),
      openedAt: snap.openedAt !== null ? String(snap.openedAt) : '',
    });
    await this.redis.expire(key, TTL_SECONDS);
  }
}
