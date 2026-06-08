import { Injectable } from '@nestjs/common';
import { OllamaEmbeddings } from '@langchain/ollama';
import { IEmbeddingProvider } from '../../domain/port/embedding-provider.port';

@Injectable()
export class OllamaEmbeddingProvider implements IEmbeddingProvider {
  private readonly client: OllamaEmbeddings;

  constructor(baseUrl = 'http://localhost:11434', model = 'nomic-embed-text') {
    this.client = new OllamaEmbeddings({ baseUrl, model });
  }

  async embed(texts: string[]): Promise<number[][]> {
    return this.client.embedDocuments(texts);
  }
}
