import { Injectable, Optional } from '@nestjs/common';
import { TokenUsage } from '../domain/vo/token-usage.vo';
import { FallbackService } from './fallback.service';
import { CostTrackingService } from './cost-tracking.service';
import { LlmRoutingService } from './llm-routing.service';
import { GatewayCallCommand } from './command/gateway-call.command';
import { LangSmithTracingService } from './langsmith-tracing.service';

@Injectable()
export class LlmGatewayService {
  constructor(
    private readonly fallback: FallbackService,
    private readonly costTracking: CostTrackingService,
    private readonly routing: LlmRoutingService,
    @Optional() private readonly langSmithTracing?: LangSmithTracingService,
  ) {}

  async *stream(command: GatewayCallCommand): AsyncIterable<string> {
    const chain = this.routing.resolveChain(command.preferredModel);
    const iter = this.fallback.streamWithFallback(command.messages, chain);
    const startTime = Date.now();

    let usedModel = chain[0];
    const promptTokens = command.messages.reduce(
      (sum, m) => sum + Math.ceil(m.content.length / 4),
      0,
    );
    let completionTokens = 0;
    const attemptedModels = new Set<string>();
    const outputTokens: string[] = [];

    for await (const { token, model } of iter) {
      usedModel = model;
      attemptedModels.add(model);
      if (token !== undefined) {
        completionTokens += 1;
        outputTokens.push(token);
        yield token;
      }
    }

    await this.costTracking.track({
      model: usedModel,
      feature: command.feature,
      tenant: command.tenant,
      usage: TokenUsage.of(promptTokens, completionTokens),
      fallbackUsed: usedModel !== chain[0],
      attemptedModels: [...attemptedModels],
    });

    void this.langSmithTracing?.logLlmRun({
      name: 'llm-gateway',
      messages: command.messages,
      answer: outputTokens.join(''),
      model: usedModel,
      completionTokens,
      feature: command.feature,
      tenant: command.tenant,
      startTime,
      endTime: Date.now(),
    });
  }
}
