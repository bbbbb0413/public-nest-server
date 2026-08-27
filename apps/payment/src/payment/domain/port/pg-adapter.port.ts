export interface PgApprovalRequest {
  paymentId: number;
  amount: number;
  currency: string;
  paymentMethod: string;
}

export interface PgApprovalResult {
  approved: boolean;
  pgTransactionId: string;
  reason?: string;
}

export interface PgTransactionRecord {
  pgTransactionId: string;
  paymentId: number;
  amount: number;
  approved: boolean;
  approvedAt: Date;
}

/**
 * 실제 PG사가 정해지면 이 인터페이스를 그대로 구현하는 어댑터로 교체한다.
 * 지금은 MockPgAdapter가 유일한 구현체다.
 */
export interface IPgAdapter {
  /** 결제 승인을 요청한다. 네트워크 오류는 use case 쪽에서 재시도로 감싼다. */
  requestApproval(request: PgApprovalRequest): Promise<PgApprovalResult>;
  /** 대사(reconciliation)를 위해 PG 쪽 거래 내역을 조회한다. */
  listTransactions(from: Date, to: Date): Promise<PgTransactionRecord[]>;
  /** 웹훅 페이로드의 서명을 검증한다. PG마다 서명 방식이 다르므로 어댑터 책임으로 둔다. */
  verifyWebhookSignature(payload: PgWebhookPayload, signature: string): boolean;
}

export interface PgWebhookPayload {
  pgTransactionId: string;
  paymentId: number;
  status: 'APPROVED' | 'FAILED';
}

export const IPgAdapter = Symbol('IPgAdapter');
