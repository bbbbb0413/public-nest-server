import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LlmRunParams {
  name: string;
  messages: Array<{ role: string; content: string }>;
  answer: string;
  model: string;
  completionTokens: number;
  feature: string;
  tenant: string;
  startTime: number;
  endTime: number;
}

@Injectable()
export class LangSmithTracingService {
  private readonly logger = new Logger(LangSmithTracingService.name);
  private readonly enabled: boolean;
  private readonly apiKey: string | undefined;
  private readonly projectName: string;

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('LANGSMITH_TRACING') === 'true';
    this.apiKey = config.get<string>('LANGSMITH_API_KEY');
    this.projectName = config.get<string>('LANGSMITH_PROJECT') ?? 'ai-service';
  }

  async logLlmRun(params: LlmRunParams): Promise<void> {
    if (!this.enabled || !this.apiKey) return;

    try {
      const { Client } = await import('langsmith');
      const client = new Client({ apiKey: this.apiKey });
      const runId = crypto.randomUUID();

      await client.createRun({
        id: runId,
        name: params.name,
        run_type: 'llm',
        inputs: { messages: params.messages },
        start_time: params.startTime,
        project_name: this.projectName,
      });

      await client.updateRun(runId, {
        outputs: {
          answer: params.answer,
          model: params.model,
          completion_tokens: params.completionTokens,
        },
        end_time: params.endTime,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`LangSmith 기록 실패 (무시): ${msg}`);
    }
  }
}
