import { Inject, Injectable } from '@nestjs/common';
import { ILlmProvider, LlmProvider, LlmMessage } from '@libs/llm';
import { IEmbeddingProvider, EmbeddingProvider } from '@libs/llm';
import {
  IVectorStorePort,
  VectorStorePort,
  SimilaritySearchResult,
} from '../../knowledge/domain/port/vector-store.port';
import { AskCommand } from './ask.command';

@Injectable()
export class AskUseCase {
  constructor(
    @Inject(LlmProvider) private readonly llmProvider: ILlmProvider,
    @Inject(EmbeddingProvider)
    private readonly embeddingProvider: IEmbeddingProvider,
    @Inject(VectorStorePort) private readonly vectorStore: IVectorStorePort,
  ) {}

  async *execute(command: AskCommand): AsyncIterable<string> {
    const [queryEmbedding] = await this.embeddingProvider.embed([
      command.question,
    ]);
    const chunks = await this.vectorStore.similaritySearch(
      queryEmbedding,
      command.topK,
    );
    const messages = this.buildRagMessages(command.question, chunks);
    yield* this.llmProvider.stream(messages);
  }

  private buildRagMessages(
    question: string,
    chunks: SimilaritySearchResult[],
  ): LlmMessage[] {
    const context = chunks
      .map((c, i) => `[출처 ${i + 1}: ${c.metadata.fileName}]\n${c.text}`)
      .join('\n\n');

    return [
      {
        role: 'system',
        content: `당신은 주어진 문서를 기반으로 질문에 답변하는 AI 어시스턴트입니다.
반드시 아래 제공된 컨텍스트만을 참고하여 답변하세요.
컨텍스트에 없는 내용은 "제공된 문서에서 해당 정보를 찾을 수 없습니다."라고 답변하세요.

컨텍스트:
${context}`,
      },
      {
        role: 'user',
        content: question,
      },
    ];
  }
}
