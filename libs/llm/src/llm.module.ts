import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProvider } from './domain/port/llm-provider.port';
import { EmbeddingProvider } from './domain/port/embedding-provider.port';
import { ClaudeProvider } from './infrastructure/claude/claude.provider';
import { OpenAIProvider } from './infrastructure/openai/openai.provider';
import { OpenAIEmbeddingProvider } from './infrastructure/openai/openai-embedding.provider';
import { GeminiProvider } from './infrastructure/gemini/gemini.provider';
import { GroqProvider } from './infrastructure/groq/groq.provider';
import { OllamaProvider } from './infrastructure/ollama/ollama.provider';
import { OllamaEmbeddingProvider } from './infrastructure/ollama/ollama-embedding.provider';

export type LlmProviderType =
  | 'claude'
  | 'openai'
  | 'gemini'
  | 'groq'
  | 'ollama';
export type EmbeddingProviderType = 'openai' | 'ollama';

@Module({})
export class LlmModule {
  static forRootAsync(): DynamicModule {
    return {
      module: LlmModule,
      imports: [],
      providers: [
        {
          provide: LlmProvider,
          inject: [ConfigService],
          useFactory: (config: ConfigService) => {
            const provider = config.get<LlmProviderType>(
              'LLM_PROVIDER',
              'claude',
            );
            switch (provider) {
              case 'openai':
                return new OpenAIProvider(
                  config.getOrThrow('OPENAI_API_KEY'),
                  config.get('OPENAI_MODEL'),
                );
              case 'gemini':
                return new GeminiProvider(
                  config.getOrThrow('GOOGLE_API_KEY'),
                  config.get('GEMINI_MODEL'),
                );
              case 'groq':
                return new GroqProvider(
                  config.getOrThrow('GROQ_API_KEY'),
                  config.get('GROQ_MODEL'),
                );
              case 'ollama':
                return new OllamaProvider(
                  config.get('OLLAMA_BASE_URL', 'http://localhost:11434'),
                  config.get('OLLAMA_MODEL', 'llama3.2'),
                );
              case 'claude':
              default:
                return new ClaudeProvider(
                  config.getOrThrow('ANTHROPIC_API_KEY'),
                  config.get('CLAUDE_MODEL'),
                );
            }
          },
        },
        {
          provide: EmbeddingProvider,
          inject: [ConfigService],
          useFactory: (config: ConfigService) => {
            const embProvider = config.get<EmbeddingProviderType>(
              'EMBEDDING_PROVIDER',
              'openai',
            );
            if (embProvider === 'ollama') {
              return new OllamaEmbeddingProvider(
                config.get('OLLAMA_BASE_URL', 'http://localhost:11434'),
                config.get('OLLAMA_EMBEDDING_MODEL', 'nomic-embed-text'),
              );
            }
            return new OpenAIEmbeddingProvider(
              config.getOrThrow('OPENAI_API_KEY'),
              config.get('EMBEDDING_MODEL', 'text-embedding-3-small'),
            );
          },
        },
      ],
      exports: [LlmProvider, EmbeddingProvider],
    };
  }
}
