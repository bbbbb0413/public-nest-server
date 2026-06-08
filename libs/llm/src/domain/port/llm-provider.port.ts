export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ILlmProvider {
  chat(messages: LlmMessage[], options?: LlmOptions): Promise<string>;
  stream(messages: LlmMessage[], options?: LlmOptions): AsyncIterable<string>;
}

export const LlmProvider = Symbol('LlmProvider');
