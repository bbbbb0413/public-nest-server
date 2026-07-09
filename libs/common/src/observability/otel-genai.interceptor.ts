import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { trace } from '@opentelemetry/api';
import { GEN_AI } from './otel-genai.constants';

@Injectable()
export class OtelGenaiInterceptor implements NestInterceptor {
  private readonly tracer = trace.getTracer('ai-service');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const span = this.tracer.startSpan('invoke_agent');
    span.setAttribute(GEN_AI.OPERATION_NAME, 'invoke_agent');
    const start = Date.now();

    return next.handle().pipe(
      tap({
        complete: () => {
          span.setAttribute(GEN_AI.OPERATION_DURATION, Date.now() - start);
          span.end();
        },
        error: (e: unknown) => {
          span.recordException(e instanceof Error ? e : new Error('unknown'));
          span.end();
        },
      }),
    );
  }
}
