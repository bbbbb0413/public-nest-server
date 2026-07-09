import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProvider, LlmProvider } from '@libs/llm';
import { VectorStorePort } from '../src/knowledge/domain/port/vector-store.port';
import { LexicalSearchPort } from '../src/qa/domain/port/lexical-search.port';
import { RerankerPort } from '../src/qa/domain/port/reranker.port';
import { HybridSearchUseCase } from '../src/qa/application/hybrid-search.use-case';
import { HybridSearchCommand } from '../src/qa/application/hybrid-search.command';
import { RrfFusionService } from '../src/qa/application/rrf-fusion.service';
import { HydeService } from '../src/qa/application/hyde.service';

const makeChunk = (id: string) => ({
  text: `text-${id}`,
  score: 0.9,
  metadata: { documentId: id, fileName: 'f.txt', chunkIndex: 0 },
});

describe('HybridSearchUseCase', () => {
  let useCase: HybridSearchUseCase;
  const mockEmbedding = { embed: jest.fn() };
  const mockVectorStore = { similaritySearch: jest.fn() };
  const mockLexicalSearch = { search: jest.fn() };
  const mockReranker = { rerank: jest.fn() };
  const mockConfigService = { get: jest.fn().mockReturnValue(undefined) };
  const mockLlmProvider = { stream: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HybridSearchUseCase,
        RrfFusionService,
        HydeService,
        { provide: EmbeddingProvider, useValue: mockEmbedding },
        { provide: VectorStorePort, useValue: mockVectorStore },
        { provide: LexicalSearchPort, useValue: mockLexicalSearch },
        { provide: RerankerPort, useValue: mockReranker },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LlmProvider, useValue: mockLlmProvider },
      ],
    }).compile();

    useCase = module.get<HybridSearchUseCase>(HybridSearchUseCase);

    mockEmbedding.embed.mockResolvedValue([[0.1, 0.2]]);
    mockVectorStore.similaritySearch.mockResolvedValue([
      makeChunk('dense-1'),
      makeChunk('dense-2'),
    ]);
    mockLexicalSearch.search.mockResolvedValue([
      makeChunk('lex-1'),
      makeChunk('dense-1'),
    ]);
    mockReranker.rerank.mockImplementation((_q, chunks) => Promise.resolve(chunks));
  });

  afterEach(() => jest.clearAllMocks());

  it('dense 검색과 lexical 검색을 병렬로 실행한다', async () => {
    const resolveOrder: string[] = [];
    mockVectorStore.similaritySearch.mockImplementation(async () => {
      resolveOrder.push('dense');
      return [makeChunk('dense-1')];
    });
    mockLexicalSearch.search.mockImplementation(async () => {
      resolveOrder.push('lexical');
      return [makeChunk('lex-1')];
    });

    await useCase.execute(new HybridSearchCommand('질문', 5));
    expect(resolveOrder).toContain('dense');
    expect(resolveOrder).toContain('lexical');
  });

  it('결과에 queryEmbedding과 chunks가 포함된다', async () => {
    const result = await useCase.execute(new HybridSearchCommand('질문', 5));
    expect(result.queryEmbedding).toEqual([0.1, 0.2]);
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  it('topK개 이하로 결과를 반환한다', async () => {
    mockReranker.rerank.mockImplementation((_q, chunks) => Promise.resolve(chunks));
    const result = await useCase.execute(new HybridSearchCommand('질문', 2));
    expect(result.chunks.length).toBeLessThanOrEqual(2);
  });

  it('RERANKER_ENABLED=false이면 reranker를 호출하지 않는다', async () => {
    mockConfigService.get.mockImplementation((key: string) =>
      key === 'RERANKER_ENABLED' ? 'false' : undefined,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HybridSearchUseCase,
        RrfFusionService,
        HydeService,
        { provide: EmbeddingProvider, useValue: mockEmbedding },
        { provide: VectorStorePort, useValue: mockVectorStore },
        { provide: LexicalSearchPort, useValue: mockLexicalSearch },
        { provide: RerankerPort, useValue: mockReranker },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LlmProvider, useValue: mockLlmProvider },
      ],
    }).compile();
    const noRerankerUseCase = module.get<HybridSearchUseCase>(HybridSearchUseCase);

    await noRerankerUseCase.execute(new HybridSearchCommand('질문', 5));
    expect(mockReranker.rerank).not.toHaveBeenCalled();
  });

  it('useHyde=true이고 질문이 짧으면 LLM으로 가설 답변을 생성해 임베딩한다', async () => {
    async function* gen() {
      yield '가설 답변 내용';
    }
    mockLlmProvider.stream.mockReturnValue(gen());

    await useCase.execute(new HybridSearchCommand('환불 정책', 5, true));

    expect(mockLlmProvider.stream).toHaveBeenCalledTimes(1);
    expect(mockEmbedding.embed).toHaveBeenCalledWith(['가설 답변 내용']);
  });

  it('useHyde=false이면 LLM을 호출하지 않는다', async () => {
    await useCase.execute(new HybridSearchCommand('환불 정책', 5, false));
    expect(mockLlmProvider.stream).not.toHaveBeenCalled();
  });
});
