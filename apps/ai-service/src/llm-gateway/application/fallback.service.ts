import { Inject, Injectable, Logger } from '@nestjs/common';
import { ILlmProvider, LlmMessage, LlmProvider } from '@libs/llm';
import {
  CircuitBreakerPort,
  ICircuitBreakerPort,
} from '../domain/port/circuit-breaker.port';

@Injectable()
export class FallbackService {
  private readonly logger = new Logger(FallbackService.name);

  constructor(
    @Inject(LlmProvider) private readonly llm: ILlmProvider,
    @Inject(CircuitBreakerPort) private readonly breaker: ICircuitBreakerPort,
  ) {}

  async *streamWithFallback(
    messages: LlmMessage[],
    chain: readonly string[],
  ): AsyncIterable<{ token?: string; model: string }> {
    const attempted: string[] = [];

    for (const model of chain) {
      attempted.push(model);

      if (!(await this.breaker.canCall(model))) {
        this.logger.warn(`회로 개방으로 모델 건너뜀: ${model}`);
        continue;
      }

      try {
        for await (const token of this.llm.stream(messages, { model })) {
          yield { token, model };
        }
        await this.breaker.recordSuccess(model);
        return;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        this.logger.error(`모델 호출 실패(${model}) → 폴백: ${msg}`);
        await this.breaker.recordFailure(model);
      }
    }

    throw new Error(`모든 폴백 실패. 시도: ${attempted.join(' → ')}`);
  }
}
