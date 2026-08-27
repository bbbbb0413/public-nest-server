import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Histogram } from 'prom-client';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * 부하테스트에서 병목 구간을 라우트 단위로 구분해서 보기 위한 최소한의 HTTP 지연시간 지표.
 * 기본 Prometheus 수집기는 프로세스 지표(메모리/GC)만 내보내서, 어느 엔드포인트가
 * 느려지는지는 이게 없으면 알 수 없었다.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric('http_request_duration_seconds')
    private readonly histogram: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const route = request.route?.path || request.url;
    const end = this.histogram.startTimer({
      method: request.method,
      route,
    });

    return next.handle().pipe(
      tap({
        next: () => end({ status: '2xx' }),
        error: (error: { status?: number }) =>
          end({ status: `${Math.floor((error.status || 500) / 100)}xx` }),
      }),
    );
  }
}
