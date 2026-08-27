export interface OutboxEventRecord {
  id: number;
  aggregateId: number;
  eventType: string;
  payload: unknown;
  attempts: number;
}

export interface IPaymentOutboxRepository {
  findPendingBatch(limit: number): Promise<OutboxEventRecord[]>;
  markPublished(id: number): Promise<void>;
  markFailedAttempt(id: number, maxAttempts: number): Promise<void>;
}

export const IPaymentOutboxRepository = Symbol('IPaymentOutboxRepository');
