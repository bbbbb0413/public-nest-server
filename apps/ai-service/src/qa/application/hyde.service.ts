import { Inject, Injectable } from '@nestjs/common';
import { ILlmProvider, LlmProvider } from '@libs/llm';

const MIN_QUERY_WORDS = 3;
const MAX_QUERY_WORDS = 10;

@Injectable()
export class HydeService {
  constructor(
    @Inject(LlmProvider) private readonly llmProvider: ILlmProvider,
  ) {}

  private getWordCount(text: string): number {
    const spaceWords = text.trim().split(/\s+/).length;
    if (spaceWords === 1) {
      return Math.ceil(text.replace(/\s/g, '').length / 3);
    }
    return spaceWords;
  }

  shouldApply(question: string): boolean {
    const trimmed = question.trim();
    if (!trimmed) return false;
    const wordCount = this.getWordCount(trimmed);
    return wordCount >= MIN_QUERY_WORDS && wordCount <= MAX_QUERY_WORDS;
  }

  async generateHypothetical(question: string): Promise<string> {
    const messages = [
      {
        role: 'system' as const,
        content:
          '다음 질문에 대해 간결하고 사실적인 답변을 2-3문장으로 작성하세요. 이 답변은 문서 검색 쿼리로 활용됩니다.',
      },
      { role: 'user' as const, content: question },
    ];

    const tokens: string[] = [];
    for await (const token of this.llmProvider.stream(messages)) {
      tokens.push(token);
    }
    return tokens.join('');
  }
}
