import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { IPgAdapter } from '../../domain/port/pg-adapter.port';
import { IPaymentRepository } from '../../domain/repository/payment.repository';
import { PaymentStatus } from '../../domain/model/payment-status.enum';

const RECONCILE_INTERVAL_MS =
  Number(process.env.PAYMENT_RECONCILE_INTERVAL_MS) || 24 * 60 * 60 * 1000;
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

export interface ReconciliationResult {
  checked: number;
  mismatches: string[];
}

/**
 * 매일 1회(기본값, PAYMENT_RECONCILE_INTERVAL_MS로 조정 가능) PG 쪽 거래 내역과
 * 내부 결제 상태를 비교해 불일치를 로깅한다. 실제 알림 채널(Slack 등)은 이 레포에
 * 아직 연결돼 있지 않아, 지금은 로깅까지만 한다.
 *
 * 이 앱이 계속 떠 있어야 setInterval이 유지된다 — 정확한 벽시계 기준(예: 매일 03:00)
 * 크론이 필요하면 별도로 스케줄러 의존성을 추가해야 한다.
 */
@Injectable()
export class PaymentReconciliationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PaymentReconciliationService.name);
  private timer: NodeJS.Timeout;

  constructor(
    @Inject(IPgAdapter) private readonly pgAdapter: IPgAdapter,
    @Inject(IPaymentRepository)
    private readonly paymentRepository: IPaymentRepository,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(
      () => void this.reconcileOnce(),
      RECONCILE_INTERVAL_MS,
    );
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async reconcileOnce(): Promise<ReconciliationResult> {
    const to = new Date();
    const from = new Date(to.getTime() - LOOKBACK_MS);
    const pgTransactions = await this.pgAdapter.listTransactions(from, to);

    const mismatches: string[] = [];
    for (const tx of pgTransactions) {
      const payment = await this.paymentRepository.findPaymentById(
        tx.paymentId,
      );
      if (!payment) {
        mismatches.push(
          `PG에는 있으나 내부 DB에 없음: paymentId=${tx.paymentId} pgTransactionId=${tx.pgTransactionId}`,
        );
        continue;
      }
      const expectedStatus = tx.approved
        ? PaymentStatus.COMPLETED
        : PaymentStatus.FAILED;
      if (payment.status !== expectedStatus) {
        mismatches.push(
          `상태 불일치: paymentId=${tx.paymentId} 내부=${payment.status} PG=${expectedStatus}`,
        );
      }
    }

    if (mismatches.length > 0) {
      this.logger.error(
        `대사 불일치 ${mismatches.length}건 발견 (검사 대상 ${pgTransactions.length}건)\n${mismatches.join('\n')}`,
      );
    } else {
      this.logger.log(
        `대사 완료: 불일치 없음 (검사 대상 ${pgTransactions.length}건)`,
      );
    }

    return { checked: pgTransactions.length, mismatches };
  }
}
