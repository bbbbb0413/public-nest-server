import Groq from 'groq-sdk';
import { ChatCompletionCreateParamsNonStreaming } from 'groq-sdk/src/resources/chat/completions';
import { EmbeddingCreateParams } from 'groq-sdk/src/resources/embeddings';

export class GroqProvider {
  private groq: Groq;
  private readonly promptTemplate: { role: string; content: string }[];

  constructor() {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.promptTemplate = [
      {
        role: 'system',
        content:
          'Korea, 한국인, 개발자, Nestjs, Mysql, Redis, Kubernetes, Gcp, 모든 대답은 한국어로 대답',
      },
    ];
  }

  async getGroqChatCompletion(body: ChatCompletionCreateParamsNonStreaming) {
    return this.groq.chat.completions.create({
      ...body,
      messages: [...this.promptTemplate, ...body.messages] as any,
    });
  }

  async embedding(body: EmbeddingCreateParams) {
    return this.groq.embeddings.create(body);
  }
}
