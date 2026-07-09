import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  RagasEvaluationRepositoryImpl,
  RagasEvaluationDoc,
} from '../infrastructure/persistence/ragas-evaluation.repository-impl';
import { RagasEvalPayload } from './ragas-eval.payload';

const ragasScoreSchema = z.object({
  faithfulness: z.number().min(0).max(1),
  answerRelevancy: z.number().min(0).max(1),
  contextPrecision: z.number().min(0).max(1),
});

type RagasScores = z.infer<typeof ragasScoreSchema>;

interface LlmEval {
  invoke: (input: string) => Promise<RagasScores>;
}

@Injectable()
export class RagasEvalService {
  private readonly logger = new Logger(RagasEvalService.name);
  /** LLM 평가 모드에서만 초기화 — 테스트에서 override 가능 */
  llmEval: LlmEval | null = null;

  constructor(
    private readonly repo: RagasEvaluationRepositoryImpl,
    private readonly config: ConfigService,
  ) {
    const enabled = config.get<string>('RAGAS_LLM_EVAL_ENABLED') === 'true';
    const apiKey = config.get<string>('OPENAI_API_KEY');
    if (enabled && apiKey) {
      this.initLlmEval(apiKey);
    }
  }

  private initLlmEval(apiKey: string): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ChatOpenAI } = require('@langchain/openai');
      const model = new ChatOpenAI({
        model: 'gpt-4o-mini',
        temperature: 0,
        apiKey,
      });
      this.llmEval = model.withStructuredOutput(ragasScoreSchema);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `RAGAS LLM 평가 초기화 실패 (휴리스틱으로 폴백): ${msg}`,
      );
    }
  }

  async evaluate(payload: RagasEvalPayload): Promise<void> {
    let scores: RagasScores;

    if (this.llmEval) {
      scores = await this.scoreLlm(payload).catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`RAGAS LLM 평가 실패 (휴리스틱 폴백): ${msg}`);
        return this.scoreHeuristic(payload);
      });
    } else {
      scores = this.scoreHeuristic(payload);
    }

    const doc: RagasEvaluationDoc = {
      traceId: payload.traceId,
      question: payload.question,
      faithfulness: scores.faithfulness,
      answerRelevancy: scores.answerRelevancy,
      contextPrecision: scores.contextPrecision,
      sampledAt: new Date(),
    };

    await this.repo.persist(doc);
  }

  private async scoreLlm(payload: RagasEvalPayload): Promise<RagasScores> {
    const contextsText = payload.contexts
      .map((c, i) => `[${i + 1}] ${c}`)
      .join('\n');

    const prompt = `아래 질문, 답변, 컨텍스트를 평가하여 0~1 사이의 점수를 반환하세요.

질문: ${payload.question}
답변: ${payload.answer}
컨텍스트:
${contextsText}

평가 기준:
- faithfulness: 답변이 컨텍스트 사실에 기반하는 정도 (0=전혀 없음, 1=완전히 기반)
- answerRelevancy: 답변이 질문에 관련된 정도 (0=무관, 1=완전히 관련)
- contextPrecision: 컨텍스트가 질문 답변에 적합한 정도 (0=무관, 1=완전히 적합)`;

    return this.llmEval!.invoke(prompt);
  }

  private scoreHeuristic(payload: RagasEvalPayload): RagasScores {
    return {
      faithfulness: this.scoreFaithfulness(payload.answer, payload.contexts),
      answerRelevancy: this.scoreAnswerRelevancy(
        payload.answer,
        payload.question,
      ),
      contextPrecision: this.scoreContextPrecision(payload.contexts),
    };
  }

  private scoreFaithfulness(answer: string, contexts: string[]): number {
    if (!answer || contexts.length === 0) return 0;
    const totalLength = contexts.reduce((sum, c) => sum + c.length, 0);
    if (totalLength === 0) return 0;
    const overlap = contexts.filter((c) =>
      answer.split(' ').some((word) => word.length > 2 && c.includes(word)),
    ).length;
    return Math.min(overlap / contexts.length, 1);
  }

  private scoreAnswerRelevancy(answer: string, question: string): number {
    if (!answer || !question) return 0;
    const questionWords = new Set(question.toLowerCase().split(/\s+/));
    const answerWords = answer.toLowerCase().split(/\s+/);
    const matched = answerWords.filter((w) => questionWords.has(w)).length;
    return Math.min(matched / Math.max(questionWords.size, 1), 1);
  }

  private scoreContextPrecision(contexts: string[]): number {
    if (contexts.length === 0) return 0;
    // 휴리스틱으로 contextPrecision을 정확히 측정할 수 없으므로 중립값 반환
    // 정확한 측정이 필요하면 RAGAS_LLM_EVAL_ENABLED=true 설정
    return 0.5;
  }
}
