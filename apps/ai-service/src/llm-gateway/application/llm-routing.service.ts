import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_CHAIN = ['claude-sonnet-4-6'];

@Injectable()
export class LlmRoutingService {
  private readonly logger = new Logger(LlmRoutingService.name);
  private readonly chain: string[];

  constructor(private readonly configService: ConfigService) {
    const raw = this.configService.get<string>('LLM_FALLBACK_CHAIN');
    const rawChain = raw
      ? raw
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean)
      : DEFAULT_CHAIN;

    const primaryModel = this.resolveProviderModel();
    if (primaryModel) {
      this.chain = [
        primaryModel,
        ...rawChain.filter((m) => m !== primaryModel),
      ];
    } else {
      this.chain = rawChain;
    }
    this.logger.log(`LLM fallback chain: ${this.chain.join(' → ')}`);
  }

  private resolveProviderModel(): string | null {
    const provider = this.configService.get<string>('LLM_PROVIDER') ?? 'ollama';
    switch (provider) {
      case 'groq':
        return (
          this.configService.get<string>('GROQ_MODEL') ??
          'llama-3.3-70b-versatile'
        );
      case 'ollama':
        return this.configService.get<string>('OLLAMA_MODEL') ?? null;
      case 'openai':
        return this.configService.get<string>('OPENAI_MODEL') ?? null;
      case 'claude':
        return this.configService.get<string>('CLAUDE_MODEL') ?? null;
      case 'gemini':
        return this.configService.get<string>('GOOGLE_MODEL') ?? null;
      default:
        return null;
    }
  }

  resolveChain(preferredModel?: string): string[] {
    if (!preferredModel) return this.chain;

    const without = this.chain.filter((m) => m !== preferredModel);
    return [preferredModel, ...without];
  }
}
