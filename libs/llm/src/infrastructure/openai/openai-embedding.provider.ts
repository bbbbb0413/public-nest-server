import { Injectable } from '@nestjs/common';
import { OpenAIEmbeddings } from '@langchain/openai';
import { IEmbeddingProvider } from '../../domain/port/embedding-provider.port';

@Injectable()
export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  private readonly client: OpenAIEmbeddings;

  constructor(apiKey: string, model = 'text-embedding-3-small') {
    this.client = new OpenAIEmbeddings({ apiKey, model });
  }

  async embed(texts: string[]): Promise<number[][]> {
    return this.client.embedDocuments(texts);
  }
}
