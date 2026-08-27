import { randomUUID, createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AbstractRedisRepository } from '@libs/common/databases/redis/abstract-redis.repository';
import {
  IPgAdapter,
  PgApprovalRequest,
  PgApprovalResult,
  PgTransactionRecord,
  PgWebhookPayload,
} from '../../domain/port/pg-adapter.port';

const MOCK_PG_DB = 5;
const LEDGER_KEY = 'mock-pg:ledger';
const TRANSACTION_KEY_PREFIX = 'mock-pg:transaction:';

/**
 * 실제 PG 없이도 승인/실패/대사 흐름을 검증하기 위한 가짜 PG.
 * 자기 자신의 거래 내역을 Redis(별도 db)에 "PG 쪽 원장"처럼 남겨서,
 * 대사(reconciliation) 배치가 내부 DB와 비교할 대상이 실제로 존재하게 한다.
 *
 * 승인 결정은 결정적이다: amount === DECLINE_SENTINEL_AMOUNT 이면 항상 거절한다.
 * (테스트에서 실패 경로를 재현 가능하게 하기 위함 — 실제 PG처럼 무작위 실패를 흉내내지 않는다.)
 */
export const MOCK_PG_DECLINE_SENTINEL_AMOUNT = 999999;

interface StoredTransaction {
  pgTransactionId: string;
  paymentId: number;
  amount: number;
  approved: boolean;
  approvedAt: string;
}

@Injectable()
export class MockPgAdapter extends AbstractRedisRepository implements IPgAdapter {
  protected readonly dbNumber = MOCK_PG_DB;

  private readonly webhookSecret =
    process.env.PG_WEBHOOK_SECRET || 'mock-pg-webhook-secret';

  constructor() {
    super();
    this.createRedisClient();
  }

  async requestApproval(request: PgApprovalRequest): Promise<PgApprovalResult> {
    const approved = request.amount !== MOCK_PG_DECLINE_SENTINEL_AMOUNT;
    const pgTransactionId = randomUUID();

    const stored: StoredTransaction = {
      pgTransactionId,
      paymentId: request.paymentId,
      amount: request.amount,
      approved,
      approvedAt: new Date().toISOString(),
    };
    await this.redis.set(
      `${TRANSACTION_KEY_PREFIX}${pgTransactionId}`,
      JSON.stringify(stored),
    );
    await this.redis.zadd(LEDGER_KEY, Date.now(), pgTransactionId);

    return {
      approved,
      pgTransactionId,
      reason: approved ? undefined : '한도 초과(mock)',
    };
  }

  async listTransactions(from: Date, to: Date): Promise<PgTransactionRecord[]> {
    const ids = await this.redis.zrangebyscore(
      LEDGER_KEY,
      from.getTime(),
      to.getTime(),
    );
    if (ids.length === 0) {
      return [];
    }

    const raws = await this.redis.mget(
      ids.map((id) => `${TRANSACTION_KEY_PREFIX}${id}`),
    );

    return raws
      .filter((raw): raw is string => !!raw)
      .map((raw) => {
        const stored = JSON.parse(raw) as StoredTransaction;
        return {
          pgTransactionId: stored.pgTransactionId,
          paymentId: stored.paymentId,
          amount: stored.amount,
          approved: stored.approved,
          approvedAt: new Date(stored.approvedAt),
        };
      });
  }

  verifyWebhookSignature(payload: PgWebhookPayload, signature: string): boolean {
    const expected = this.sign(payload);
    return expected === signature;
  }

  sign(payload: PgWebhookPayload): string {
    const canonical = `${payload.pgTransactionId}.${payload.paymentId}.${payload.status}`;
    return createHmac('sha256', this.webhookSecret).update(canonical).digest('hex');
  }
}
