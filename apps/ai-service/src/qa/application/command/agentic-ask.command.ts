import { IterationBudget } from '../../domain/vo/iteration-budget.vo';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export class AgenticAskCommand {
  constructor(
    readonly question: string,
    readonly topK: number = 5,
    readonly tenant: string | undefined = undefined,
    readonly budget: IterationBudget,
    readonly confidenceThreshold: number = 0.8,
    readonly userId?: string,
    readonly conversationHistory?: ConversationTurn[],
    readonly useHyde: boolean = false,
  ) {}
}
