import { AggregateRoot } from '@libs/shared-kernel';

export type BreakerStatus = 'closed' | 'open' | 'half-open';

const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 60_000;

export interface CircuitBreakerSnapshot {
  model: string;
  status: BreakerStatus;
  failureCount: number;
  openedAt: number | null;
}

export class CircuitBreakerState extends AggregateRoot {
  private constructor(
    readonly model: string,
    private status: BreakerStatus,
    private failureCount: number,
    private openedAt: number | null,
  ) {
    super();
  }

  static create(model: string): CircuitBreakerState {
    return new CircuitBreakerState(model, 'closed', 0, null);
  }

  static restore(props: CircuitBreakerSnapshot): CircuitBreakerState {
    return new CircuitBreakerState(
      props.model,
      props.status,
      props.failureCount,
      props.openedAt,
    );
  }

  canCall(now: number): boolean {
    if (
      this.status === 'open' &&
      this.openedAt !== null &&
      now - this.openedAt >= RESET_TIMEOUT_MS
    ) {
      this.status = 'half-open';
    }
    return this.status !== 'open';
  }

  recordFailure(now: number): void {
    this.failureCount += 1;
    if (this.failureCount >= FAILURE_THRESHOLD || this.status === 'half-open') {
      this.status = 'open';
      this.openedAt = now;
    }
  }

  recordSuccess(): void {
    this.status = 'closed';
    this.failureCount = 0;
    this.openedAt = null;
  }

  getStatus(): BreakerStatus {
    return this.status;
  }

  snapshot(): CircuitBreakerSnapshot {
    return {
      model: this.model,
      status: this.status,
      failureCount: this.failureCount,
      openedAt: this.openedAt,
    };
  }
}
