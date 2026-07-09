import { Inject, Injectable } from '@nestjs/common';
import { ILlmProvider, LlmProvider, LlmMessage } from '@libs/llm';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

const FOLLOW_UP_INDICATORS = [
  '이것',
  '그것',
  '저것',
  '위에서',
  '앞에서',
  '해당',
  '이 내용',
  '그 내용',
  '이거',
  '그거',
  '앞서',
  '거기',
  '여기',
  ' it ',
  ' this ',
  ' that ',
  ' those ',
  ' they ',
  ' there ',
];

@Injectable()
export class ConversationalQueryRewriter {
  constructor(
    @Inject(LlmProvider) private readonly llmProvider: ILlmProvider,
  ) {}

  isFollowUp(question: string, history: ConversationTurn[]): boolean {
    if (history.length === 0) return false;
    const lower = question.toLowerCase();
    return FOLLOW_UP_INDICATORS.some((ind) => lower.includes(ind));
  }

  async rewrite(
    question: string,
    history: ConversationTurn[],
  ): Promise<string> {
    const historyText = history
      .slice(-4)
      .map(
        (t) => `${t.role === 'user' ? '사용자' : '어시스턴트'}: ${t.content}`,
      )
      .join('\n');

    const messages: LlmMessage[] = [
      {
        role: 'user',
        content: `이전 대화:
${historyText}

위 대화 맥락을 참고하여, 다음 질문을 이전 대화 없이도 이해할 수 있는 독립적인 질문으로 재작성하세요.
재작성된 질문만 출력하세요.

질문: ${question}`,
      },
    ];

    const tokens: string[] = [];
    for await (const token of this.llmProvider.stream(messages)) {
      tokens.push(token);
    }
    const rewritten = tokens.join('').trim();
    return rewritten || question;
  }
}
