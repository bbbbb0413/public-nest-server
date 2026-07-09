import { createHash } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PDFParse } from 'pdf-parse';
import {
  IEmbeddingProvider,
  EmbeddingProvider,
  ILlmProvider,
  LlmProvider,
} from '@libs/llm';
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
import { RagContentValidator } from '../../qa/application/filter/rag-content-validator';

const KOREAN_SENTENCE_ENDINGS = ['다. ', '요. ', '까. ', '죠. ', '나. '];

@Injectable()
export class IngestDocumentUseCase {
  private readonly logger = new Logger(IngestDocumentUseCase.name);
  private readonly contextualEmbeddingsEnabled: boolean;

  // Parent chunks (1024자) — LLM 컨텍스트 전달용
  private readonly parentSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1024,
    chunkOverlap: 200,
    separators: ['\f', '\n\n', '\n', ...KOREAN_SENTENCE_ENDINGS, ' ', ''],
  });

  // Child chunks (256자) — 벡터 검색용 (정밀 매칭)
  private readonly childSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 256,
    chunkOverlap: 50,
    separators: ['\n\n', '\n', ...KOREAN_SENTENCE_ENDINGS, ' ', ''],
  });

  constructor(
    @Inject(DocumentRepository)
    private readonly documentRepo: IDocumentRepository,
    @Inject(VectorStorePort) private readonly vectorStore: IVectorStorePort,
    @Inject(EmbeddingProvider)
    private readonly embeddingProvider: IEmbeddingProvider,
    @Inject(LlmProvider) private readonly llmProvider: ILlmProvider,
    private readonly ragValidator: RagContentValidator,
    private readonly configService: ConfigService,
  ) {
    this.contextualEmbeddingsEnabled =
      this.configService.get<string>('CONTEXTUAL_EMBEDDINGS_ENABLED') ===
      'true';
  }

  async execute(command: IngestDocumentCommand): Promise<Document> {
    let document: Document;

    if (command.documentId) {
      const existing = await this.documentRepo.findById(command.documentId);
      document =
        existing ??
        Document.create({
          fileName: command.fileName,
          mimeType: command.mimeType,
        });
    } else {
      document = Document.create({
        fileName: command.fileName,
        mimeType: command.mimeType,
      });
      document = await this.documentRepo.persist(document);
    }

    const documentId = document.id;

    try {
      const rawText = await this.extractText(command.buffer, command.mimeType);
      const verdict = this.ragValidator.scan(rawText);
      if (!verdict.isAllowed()) {
        throw new Error(`인제스트 차단: ${verdict.getReason()}`);
      }

      const vectorDocs = await this.buildVectorDocs(
        rawText,
        documentId,
        command.fileName,
      );

      await this.vectorStore.deleteByDocumentId(documentId);
      await this.vectorStore.upsert(vectorDocs);

      const processed = document.markProcessed(vectorDocs.length);
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

  private async buildVectorDocs(
    rawText: string,
    documentId: string,
    fileName: string,
  ): Promise<VectorDocument[]> {
    const parentTexts = await this.parentSplitter.splitText(rawText);

    // 각 parent에 대해 contextual prefix 생성 (활성화 시 병렬 처리)
    const contextPrefixes = this.contextualEmbeddingsEnabled
      ? await Promise.all(
          parentTexts.map((pt) =>
            this.generateContextualPrefix(fileName, rawText, pt),
          ),
        )
      : parentTexts.map(() => '');

    const vectorDocs: VectorDocument[] = [];
    let globalChildIndex = 0;

    for (let pi = 0; pi < parentTexts.length; pi++) {
      const parentText = parentTexts[pi];
      const parentId = createHash('sha256')
        .update(`${documentId}:parent:${pi}`)
        .digest('hex');
      const contextPrefix = contextPrefixes[pi];

      const childTexts = await this.childSplitter.splitText(parentText);

      // contextual prefix 없을 때도 parent 앞 100자를 붙여 회사명/섹션 헤더가 모든 child 벡터에 포함되도록 함
      const parentAnchor = parentText.substring(0, 100).trim();
      const embeddingInputs = childTexts.map((ct) => {
        const prefix = contextPrefix || parentAnchor;
        return prefix ? `${prefix}\n\n${ct}` : ct;
      });
      const embeddings = await this.embeddingProvider.embed(embeddingInputs);

      for (let ci = 0; ci < childTexts.length; ci++) {
        const childText = childTexts[ci];
        const chunk = Chunk.of(childText, globalChildIndex, documentId, {
          charCount: childText.length,
          parentChunkId: parentId,
        });

        vectorDocs.push({
          id: createHash('sha256')
            .update(`${documentId}:child:${globalChildIndex}`)
            .digest('hex'),
          text: chunk.getText(),
          embedding: embeddings[ci],
          metadata: {
            documentId,
            fileName,
            chunkIndex: chunk.getIndex(),
            charCount: chunk.getCharCount(),
            parentText,
            parentChunkId: parentId,
          },
        });

        globalChildIndex++;
      }
    }

    return vectorDocs;
  }

  private async generateContextualPrefix(
    docTitle: string,
    fullText: string,
    chunkText: string,
  ): Promise<string> {
    const docSample = fullText.substring(0, 400);
    const chunkSample = chunkText.substring(0, 200);
    const messages = [
      {
        role: 'user' as const,
        content: `<document>
제목: ${docTitle}
앞부분: ${docSample}
</document>

위 문서에서 아래 청크의 핵심 내용을 1문장으로 설명하세요. 설명 문장만 출력하세요.

<chunk>${chunkSample}</chunk>`,
      },
    ];

    const tokens: string[] = [];
    for await (const token of this.llmProvider.stream(messages)) {
      tokens.push(token);
    }
    return tokens.join('').trim();
  }

  private async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    if (mimeType === 'application/pdf') {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      await parser.destroy();
      return this.cleanPdfText(result.text);
    }
    return buffer.toString('utf-8');
  }

  private cleanPdfText(text: string): string {
    // \f (form feed) is preserved — used as PDF page boundary separator
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+$/gm, '')
      .replace(/([A-Za-z])-\n([A-Za-z])/g, '$1$2')
      .replace(
        /([가-힣A-Za-z0-9,\.。\)\]'"])\n([가-힣A-Za-z0-9\(\['"])/g,
        '$1 $2',
      )
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
