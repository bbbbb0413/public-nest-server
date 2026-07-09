import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { LlmGatewayService } from '../../llm-gateway/application/llm-gateway.service';
import { GatewayCallCommand } from '../../llm-gateway/application/command/gateway-call.command';
import { SimilaritySearchResult } from '../../knowledge/domain/port/vector-store.port';
import { Critique } from '../domain/vo/critique.vo';

const critiqueSchema = z.object({
  answered: z.boolean(),
  missing: z.array(z.string()),
  nextQuery: z.string(),
  confidence: z.number().min(0).max(1),
});

type CritiqueOutput = z.infer<typeof critiqueSchema>;

interface StructuredModel {
  invoke: (input: string) => Promise<CritiqueOutput>;
}

const CRITIQUE_PROMPT_NAME = 'rag-critique';
const DEFAULT_TENANT = 'default';

@Injectable()
export class CritiqueGeneratorService {
  private readonly logger = new Logger(CritiqueGeneratorService.name);
  /** 테스트에서 override 가능 */
  structuredModel: StructuredModel | null = null;

  constructor(
    private readonly llmGateway: LlmGatewayService,
    private readonly config: ConfigService,
  ) {
    const apiKey = config.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.initStructuredModel(apiKey);
    }
  }

  private initStructuredModel(apiKey: string): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ChatOpenAI } = require('@langchain/openai');
      const model = new ChatOpenAI({
        model: 'gpt-4o-mini',
        temperature: 0,
        apiKey,
      });
      this.structuredModel = model.withStructuredOutput(critiqueSchema);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `CritiqueGenerator structuredOutput 초기화 실패: ${msg}`,
      );
    }
  }

  async generate(
    question: string,
    answer: string,
    chunks: SimilaritySearchResult[],
    tenant?: string,
  ): Promise<Critique> {
    if (this.structuredModel) {
      try {
        return await this.generateWithStructuredOutput(
          question,
          answer,
          chunks,
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`structuredOutput 실패 (스트리밍 폴백): ${msg}`);
      }
    }

    return this.generateWithStream(question, answer, chunks, tenant);
  }

  private async generateWithStructuredOutput(
    question: string,
    answer: string,
    chunks: SimilaritySearchResult[],
  ): Promise<Critique> {
    const contextSummary = chunks
      .slice(0, 3)
      .map((c, i) => `[${i + 1}] ${c.text.slice(0, 200)}`)
      .join('\n');

    const prompt = [
      '아래 질문, 검색된 컨텍스트, 생성된 답변을 평가하세요.',
      '',
      `질문: ${question}`,
      `컨텍스트:\n${contextSummary}`,
      `답변: ${answer}`,
    ].join('\n');

    const result = await this.structuredModel!.invoke(prompt);
    return Critique.of(
      result.answered,
      result.missing,
      result.nextQuery,
      result.confidence,
    );
  }

  private async generateWithStream(
    question: string,
    answer: string,
    chunks: SimilaritySearchResult[],
    tenant?: string,
  ): Promise<Critique> {
    const contextSummary = chunks
      .slice(0, 3)
      .map((c, i) => `[${i + 1}] ${c.text.slice(0, 200)}`)
      .join('\n');

    const systemPrompt = [
      '당신은 RAG 시스템의 답변 품질을 평가하는 전문가입니다.',
      '아래 질문, 검색된 컨텍스트, 생성된 답변을 보고 JSON으로만 응답하세요.',
      '{"answered": bool, "missing": [string], "nextQuery": string, "confidence": float(0-1)}',
    ].join('\n');

    const userPrompt = [
      `질문: ${question}`,
      `컨텍스트:\n${contextSummary}`,
      `답변: ${answer}`,
    ].join('\n\n');

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    const collected: string[] = [];
    for await (const token of this.llmGateway.stream(
      new GatewayCallCommand(
        messages,
        CRITIQUE_PROMPT_NAME,
        tenant ?? DEFAULT_TENANT,
      ),
    )) {
      collected.push(token);
    }

    return this.parseCritique(collected.join(''));
  }

  private parseCritique(raw: string): Critique {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.fallbackCritique();

      const parsed = JSON.parse(jsonMatch[0]) as {
        answered?: unknown;
        missing?: unknown;
        nextQuery?: unknown;
        confidence?: unknown;
      };

      const answered = parsed.answered === true;
      const missing = Array.isArray(parsed.missing)
        ? (parsed.missing as unknown[]).filter(
            (m): m is string => typeof m === 'string',
          )
        : [];
      const nextQuery =
        typeof parsed.nextQuery === 'string' ? parsed.nextQuery : '';
      const confidence =
        typeof parsed.confidence === 'number' &&
        parsed.confidence >= 0 &&
        parsed.confidence <= 1
          ? parsed.confidence
          : 0.7;

      return Critique.of(answered, missing, nextQuery, confidence);
    } catch {
      return this.fallbackCritique();
    }
  }

  private fallbackCritique(): Critique {
    // 파싱 실패 시 첫 번째 답변을 그대로 사용 (임계값 0.6 이상으로 재반복 방지)
    return Critique.of(true, [], '', 0.7);
  }
}
