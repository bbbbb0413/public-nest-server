import { CircuitBreakerSnapshot } from '../model/circuit-breaker-state';

export interface ICircuitBreakerPort {
  canCall(model: string): Promise<boolean>;
  recordSuccess(model: string): Promise<void>;
  recordFailure(model: string): Promise<void>;
  getState(model: string): Promise<CircuitBreakerSnapshot>;
}

export const CircuitBreakerPort = Symbol('CircuitBreakerPort');
