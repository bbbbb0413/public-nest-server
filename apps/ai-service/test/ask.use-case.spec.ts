import { Test, TestingModule } from '@nestjs/testing';
import { AskUseCase } from '../src/qa/application/ask.use-case';
import { AskCommand } from '../src/qa/application/ask.command';
import { LlmProvider, EmbeddingProvider } from '@libs/llm';
import { VectorStorePort } from '../src/knowledge/domain/port/vector-store.port';

async function* asyncGen(values: string[]) {
  for (const v of values) yield v;
}

const mockLlmProvider = {
  stream: jest.fn(),
};

const mockEmbeddingProvider = {
  embed: jest.fn(),
};

const mockVectorStore = {
  similaritySearch: jest.fn(),
};

describe('AskUseCase', () => {
  let useCase: AskUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AskUseCase,
        { provide: LlmProvider, useValue: mockLlmProvider },
        { provide: EmbeddingProvider, useValue: mockEmbeddingProvider },
        { provide: VectorStorePort, useValue: mockVectorStore },
      ],
    }).compile();

    useCase = module.get<AskUseCase>(AskUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  it('질문 임베딩 → 벡터 검색 → LLM 스트리밍을 순서대로 실행한다', async () => {
    // Arrange
    mockEmbeddingProvider.embed.mockResolvedValue([[0.1, 0.2]]);
    mockVectorStore.similaritySearch.mockResolvedValue([
      {
        text: '관련 문서 내용',
        score: 0.95,
        metadata: { documentId: 'doc-1', fileName: 'docs.txt', chunkIndex: 0 },
      },
    ]);
    mockLlmProvider.stream.mockReturnValue(asyncGen(['안녕', '하세요', '!']));

    const command = new AskCommand('테스트 질문입니다');

    // Act
    const tokens: string[] = [];
    for await (const token of useCase.execute(command)) {
      tokens.push(token);
    }

    // Assert
    expect(tokens).toEqual(['안녕', '하세요', '!']);
    expect(mockEmbeddingProvider.embed).toHaveBeenCalledWith([
      '테스트 질문입니다',
    ]);
    expect(mockVectorStore.similaritySearch).toHaveBeenCalledWith(
      [0.1, 0.2],
      5,
    );
    expect(mockLlmProvider.stream).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({ role: 'user', content: '테스트 질문입니다' }),
      ]),
    );
  });
});
