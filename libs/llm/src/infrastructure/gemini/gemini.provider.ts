import { Injectable } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from '@langchain/core/messages';
import {
  ILlmProvider,
  LlmMessage,
  LlmOptions,
} from '../../domain/port/llm-provider.port';

@Injectable()
export class GeminiProvider implements ILlmProvider {
  private readonly defaultModel: string;

  constructor(
    private readonly apiKey: string,
    defaultModel = 'gemini-2.0-flash',
  ) {
    this.defaultModel = defaultModel;
  }

  private getClient(options?: LlmOptions): ChatGoogleGenerativeAI {
    return new ChatGoogleGenerativeAI({
      apiKey: this.apiKey,
      model: options?.model ?? this.defaultModel,
      temperature: options?.temperature,
      maxOutputTokens: options?.maxTokens,
    });
  }

  async chat(messages: LlmMessage[], options?: LlmOptions): Promise<string> {
    const response = await this.getClient(options).invoke(
      this.toLangchainMessages(messages),
    );
    return response.content as string;
  }

  async *stream(
    messages: LlmMessage[],
    options?: LlmOptions,
  ): AsyncIterable<string> {
    const responseStream = await this.getClient(options).stream(
      this.toLangchainMessages(messages),
    );
    for await (const chunk of responseStream) {
      if (typeof chunk.content === 'string') yield chunk.content;
    }
  }

  private toLangchainMessages(messages: LlmMessage[]) {
    return messages.map((m) => {
      if (m.role === 'system') return new SystemMessage(m.content);
      if (m.role === 'assistant') return new AIMessage(m.content);
      return new HumanMessage(m.content);
    });
  }
}
