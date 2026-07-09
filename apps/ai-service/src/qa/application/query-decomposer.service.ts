import { Inject, Injectable } from '@nestjs/common';
import { ILlmProvider, LlmProvider, LlmMessage } from '@libs/llm';

const MAX_SUB_QUERIES = 3;
const COMPOUND_INDICATORS = [
  '그리고',
  '또한',
  '아울러',
  '뿐만 아니라',
  '더불어',
  'and also',
  'additionally',
  'furthermore',
  'moreover',
];

@Injectable()
export class QueryDecomposer {
  constructor(
    @Inject(LlmProvider) private readonly llmProvider: ILlmProvider,
  ) {}

  shouldDecompose(question: string): boolean {
    const lower = question.toLowerCase();
    const hasCompound = COMPOUND_INDICATORS.some((ind) => lower.includes(ind));
    const multipleQuestions = (question.match(/\?/g) ?? []).length > 1;
    return hasCompound || multipleQuestions;
  }

  async decompose(question: string): Promise<string[]> {
    const messages: LlmMessage[] = [
      {
        role: 'user',
        content: `다음 복합 질문을 최대 ${MAX_SUB_QUERIES}개의 독립적인 단순 질문으로 분해하세요.
각 질문을 새 줄에 "- "로 시작하여 나열하세요. 질문만 출력하세요.

질문: ${question}`,
      },
    ];

    const tokens: string[] = [];
    for await (const token of this.llmProvider.stream(messages)) {
      tokens.push(token);
    }

    const subQueries = tokens
      .join('')
      .trim()
      .split('\n')
      .map((line) => line.replace(/^-\s*/, '').trim())
      .filter((line) => line.length > 0)
      .slice(0, MAX_SUB_QUERIES);

    return subQueries.length > 0 ? subQueries : [question];
  }
}
