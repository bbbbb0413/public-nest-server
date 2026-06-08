import { Inject, Injectable, Logger } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { IEmbeddingProvider, EmbeddingProvider } from '@libs/llm';
import { Document } from '../domain/model/document';
import { Chunk } from '../domain/vo/chunk.vo';
import {
  IDocumentRepository,
  DocumentRepository,
} from '../domain/repository/document.repository';
import {
  IVectorStorePort,
  VectorStorePort,
  VectorDocument,
} from '../domain/port/vector-store.port';
import { IngestDocumentCommand } from './ingest-document.command';
import { randomUUID } from 'crypto';

@Injectable()
export class IngestDocumentUseCase {
  private readonly logger = new Logger(IngestDocumentUseCase.name);
  private readonly splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  constructor(
    @Inject(DocumentRepository)
    private readonly documentRepo: IDocumentRepository,
    @Inject(VectorStorePort) private readonly vectorStore: IVectorStorePort,
    @Inject(EmbeddingProvider)
    private readonly embeddingProvider: IEmbeddingProvider,
  ) {}

  async execute(command: IngestDocumentCommand): Promise<Document> {
    let document = Document.create({
      fileName: command.fileName,
      mimeType: command.mimeType,
    });
    document = await this.documentRepo.persist(document);
    const documentId = document.id;

    try {
      const rawText = command.buffer.toString('utf-8');
      const splitTexts = await this.splitter.splitText(rawText);

      const chunks = splitTexts.map((text, index) =>
        Chunk.of(text, index, documentId),
      );
      const embeddings = await this.embeddingProvider.embed(
        chunks.map((c) => c.getText()),
      );

      const vectorDocs: VectorDocument[] = chunks.map((chunk, i) => ({
        id: randomUUID(),
        text: chunk.getText(),
        embedding: embeddings[i],
        metadata: {
          documentId,
          fileName: command.fileName,
          chunkIndex: chunk.getIndex(),
        },
      }));

      await this.vectorStore.upsert(vectorDocs);

      const processed = document.markProcessed(chunks.length);
      return this.documentRepo.update(processed);
    } catch (e: unknown) {
      this.logger.error(
        `문서 수집 실패: ${command.fileName}`,
        e instanceof Error ? e.stack : e,
      );
      const failed = document.markFailed();
      await this.documentRepo.update(failed);
      throw e;
    }
  }
}
