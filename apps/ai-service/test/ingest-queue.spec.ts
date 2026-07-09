import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import {
  IngestQueueService,
  INGEST_QUEUE,
  INGEST_JOB,
} from '../src/knowledge/application/ingest-queue.service';
import { IngestConsumer } from '../src/knowledge/infrastructure/queue/ingest.consumer';
import { IngestDocumentUseCase } from '../src/knowledge/application/ingest-document.use-case';

describe('IngestQueueService', () => {
  let service: IngestQueueService;
  const mockQueue = { add: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestQueueService,
        { provide: getQueueToken(INGEST_QUEUE), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<IngestQueueService>(IngestQueueService);
    mockQueue.add.mockResolvedValue({ id: 'job-1' });
  });

  afterEach(() => jest.clearAllMocks());

  it('올바른 큐 이름과 잡 이름으로 payload를 enqueue한다', async () => {
    // Arrange
    const payload = {
      documentId: 'doc-1',
      fileName: 'test.txt',
      mimeType: 'text/plain',
      content: Buffer.from('hello').toString('base64'),
    };

    // Act
    const job = await service.enqueue(payload);

    // Assert
    expect(mockQueue.add).toHaveBeenCalledWith(INGEST_JOB, payload);
    expect(job).toEqual({ id: 'job-1' });
  });
});

describe('IngestConsumer', () => {
  let consumer: IngestConsumer;
  const mockIngestUseCase = { execute: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestConsumer,
        { provide: IngestDocumentUseCase, useValue: mockIngestUseCase },
      ],
    }).compile();

    consumer = module.get<IngestConsumer>(IngestConsumer);
  });

  afterEach(() => jest.clearAllMocks());

  it('잡 payload를 IngestDocumentUseCase로 위임한다', async () => {
    // Arrange
    const content = Buffer.from('문서 내용').toString('base64');
    const job = {
      data: {
        documentId: 'doc-123',
        fileName: 'sample.txt',
        mimeType: 'text/plain',
        content,
      },
    } as any;
    mockIngestUseCase.execute.mockResolvedValue({});

    // Act
    await consumer.handle(job);

    // Assert
    expect(mockIngestUseCase.execute).toHaveBeenCalledWith({
      documentId: 'doc-123',
      fileName: 'sample.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('문서 내용'),
    });
  });

  it('base64 content를 Buffer로 변환하여 전달한다', async () => {
    // Arrange
    const originalText = 'Hello, World!';
    const content = Buffer.from(originalText).toString('base64');
    const job = {
      data: {
        documentId: 'd1',
        fileName: 'f.txt',
        mimeType: 'text/plain',
        content,
      },
    } as any;
    mockIngestUseCase.execute.mockResolvedValue({});

    // Act
    await consumer.handle(job);

    // Assert
    const [command] = mockIngestUseCase.execute.mock.calls[0];
    expect(command.buffer.toString('utf-8')).toBe(originalText);
  });
});
