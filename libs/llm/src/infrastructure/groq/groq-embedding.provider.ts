import { Injectable } from '@nestjs/common';
import { OpenAIEmbeddings } from '@langchain/openai';
import { IEmbeddingProvider } from '../../domain/port/embedding-provider.port';

@Injectable()
export class GroqEmbeddingProvider implements IEmbeddingProvider {
  private readonly client: OpenAIEmbeddings;

  constructor(apiKey: string, model = 'nomic-embed-text-v1.5') {
    this.client = new OpenAIEmbeddings({
      apiKey,
      model,
      configuration: { baseURL: 'https://api.groq.com/openai/v1' },
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    return this.client.embedDocuments(texts);
  }
}
