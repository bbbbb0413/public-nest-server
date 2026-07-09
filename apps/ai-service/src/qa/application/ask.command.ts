export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export class AskCommand {
  constructor(
    readonly question: string,
    readonly topK: number = 15,
    readonly tenant?: string,
    readonly useHyde: boolean = false,
    readonly userId?: string,
    readonly conversationHistory?: ConversationTurn[],
    readonly sessionId?: string,
  ) {}
}
