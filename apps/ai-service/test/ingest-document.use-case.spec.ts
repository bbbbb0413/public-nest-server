import { Test, TestingModule } from '@nestjs/testing';
import { IngestDocumentUseCase } from '../src/knowledge/application/ingest-document.use-case';
import { DocumentRepository } from '../src/knowledge/domain/repository/document.repository';
import { VectorStorePort } from '../src/knowledge/domain/port/vector-store.port';
import { EmbeddingProvider } from '@libs/llm';
import { Document } from '../src/knowledge/domain/model/document';

const mockDocumentRepo = {
  persist: jest.fn(),
  update: jest.fn(),
};

const mockVectorStore = {
  upsert: jest.fn(),
};

const mockEmbeddingProvider = {
  embed: jest.fn(),
};

describe('IngestDocumentUseCase', () => {
  let useCase: IngestDocumentUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestDocumentUseCase,
        { provide: DocumentRepository, useValue: mockDocumentRepo },
        { provide: VectorStorePort, useValue: mockVectorStore },
        { provide: EmbeddingProvider, useValue: mockEmbeddingProvider },
      ],
    }).compile();

    useCase = module.get<IngestDocumentUseCase>(IngestDocumentUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  it('문서를 성공적으로 수집하고 processed 상태로 업데이트한다', async () => {
    // Arrange
    const savedDoc = Document.restore({
      id: 'doc-1',
      fileName: 'test.txt',
      mimeType: 'text/plain',
      status: 'pending',
      chunkCount: 0,
    });
    const processedDoc = savedDoc.markProcessed(1);
    mockDocumentRepo.persist.mockResolvedValue(savedDoc);
    mockDocumentRepo.update.mockResolvedValue(processedDoc);
    mockEmbeddingProvider.embed.mockResolvedValue([[0.1, 0.2, 0.3]]);
    mockVectorStore.upsert.mockResolvedValue(undefined);

    const command = {
      fileName: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Hello world test content'),
    };

    // Act
    const result = await useCase.execute(command);

    // Assert
    expect(result.status).toBe('processed');
    expect(mockDocumentRepo.persist).toHaveBeenCalledTimes(1);
    expect(mockEmbeddingProvider.embed).toHaveBeenCalled();
    expect(mockVectorStore.upsert).toHaveBeenCalled();
    expect(mockDocumentRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processed' }),
    );
  });

  it('임베딩 실패 시 failed 상태로 업데이트하고 에러를 던진다', async () => {
    // Arrange
    const savedDoc = Document.restore({
      id: 'doc-2',
      fileName: 'fail.txt',
      mimeType: 'text/plain',
      status: 'pending',
      chunkCount: 0,
    });
    mockDocumentRepo.persist.mockResolvedValue(savedDoc);
    mockDocumentRepo.update.mockResolvedValue(savedDoc.markFailed());
    mockEmbeddingProvider.embed.mockRejectedValue(new Error('API 오류'));

    const command = {
      fileName: 'fail.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('content'),
    };

    // Act & Assert
    await expect(useCase.execute(command)).rejects.toThrow('API 오류');
    expect(mockDocumentRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
  });
});
