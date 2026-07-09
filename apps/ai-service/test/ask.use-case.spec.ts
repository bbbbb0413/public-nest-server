import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AskUseCase } from '../src/qa/application/ask.use-case';
import { AskCommand } from '../src/qa/application/ask.command';
import { HybridSearchUseCase } from '../src/qa/application/hybrid-search.use-case';
import { LlmGatewayService } from '../src/llm-gateway/application/llm-gateway.service';
import { GetActivePromptUseCase } from '../src/prompt/application/get-active-prompt.use-case';
import { LlmCachePort } from '../src/qa/domain/port/llm-cache.port';
import { SemanticCachePort } from '../src/qa/domain/port/semantic-cache.port';
import { PromptTemplate } from '../src/prompt/domain/model/prompt-template';
import { RagContentValidator } from '../src/qa/application/filter/rag-content-validator';
import { SecretPiiScanner } from '../src/qa/application/filter/secret-pii-scanner';

async function* asyncGen(values: string[]) {
  for (const v of values) yield v;
}

const defaultChunks = [
  {
    text: '관련 문서 내용',
    score: 0.95,
    metadata: { documentId: 'doc-1', fileName: 'docs.txt', chunkIndex: 0 },
  },
];

const mockLlmGatewayService = { stream: jest.fn() };
const mockHybridSearch = { execute: jest.fn() };
const mockGetActivePrompt = { execute: jest.fn() };
const mockLlmCache = {
  get: jest.fn(),
  setWithTtl: jest.fn(),
  invalidate: jest.fn(),
};
const mockSemanticCache = {
  findSimilar: jest.fn(),
  store: jest.fn(),
};
const mockConfigService = { get: jest.fn().mockReturnValue(undefined) };
const mockRagContentValidator = {
  inspectInput: jest.fn(),
  sanitize: jest.fn(),
  scan: jest.fn(),
};
const mockSecretPiiScanner = {
  mask: jest.fn().mockImplementation((text: string) => text),
};

const defaultPrompt = PromptTemplate.create({
  name: 'rag-qa-system',
  content: '컨텍스트:\n{{context}}',
  variables: ['context'],
});

describe('AskUseCase', () => {
  let useCase: AskUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AskUseCase,
        { provide: LlmGatewayService, useValue: mockLlmGatewayService },
        { provide: HybridSearchUseCase, useValue: mockHybridSearch },
        { provide: GetActivePromptUseCase, useValue: mockGetActivePrompt },
        { provide: LlmCachePort, useValue: mockLlmCache },
        { provide: SemanticCachePort, useValue: mockSemanticCache },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RagContentValidator, useValue: mockRagContentValidator },
        { provide: SecretPiiScanner, useValue: mockSecretPiiScanner },
      ],
    }).compile();

    useCase = module.get<AskUseCase>(AskUseCase);
    mockGetActivePrompt.execute.mockResolvedValue(defaultPrompt);
    mockLlmCache.get.mockResolvedValue(null);
    mockLlmCache.setWithTtl.mockResolvedValue(undefined);
    mockSemanticCache.findSimilar.mockResolvedValue(null);
    mockRagContentValidator.sanitize.mockImplementation(
      (chunks: unknown) => chunks,
    );
    mockHybridSearch.execute.mockResolvedValue({
      queryEmbedding: [0.1, 0.2],
      chunks: defaultChunks,
    });
  });

  afterEach(() => jest.clearAllMocks());

  it('하이브리드 검색 → LLM 스트리밍을 순서대로 실행한다', async () => {
    // Arrange
    mockLlmGatewayService.stream.mockReturnValue(
      asyncGen(['안녕', '하세요', '!']),
    );
    const command = new AskCommand('테스트 질문입니다');

    // Act
    const tokens: string[] = [];
    for await (const token of useCase.execute(command)) {
      tokens.push(token);
    }

    // Assert
    expect(tokens).toEqual([
      expect.stringContaining('__SOURCES:'),
      '안녕',
      '하세요',
      '!',
    ]);
    expect(mockHybridSearch.execute).toHaveBeenCalledWith(
      expect.objectContaining({ question: '테스트 질문입니다', topK: 15 }),
    );
    expect(mockLlmGatewayService.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({
            role: 'user',
            content: '테스트 질문입니다',
          }),
        ]),
        feature: 'rag-qa-system',
      }),
    );
  });

  it('DB에 활성 프롬프트가 있으면 해당 프롬프트로 시스템 메시지를 구성한다', async () => {
    // Arrange
    const customPrompt = PromptTemplate.restore({
      name: 'rag-qa-system',
      version: 2,
      content: '[커스텀]\n{{context}}',
      isActive: true,
      variables: ['context'],
    });
    mockGetActivePrompt.execute.mockResolvedValue(customPrompt);
    mockLlmGatewayService.stream.mockReturnValue(asyncGen(['응답']));

    // Act
    const tokens: string[] = [];
    for await (const token of useCase.execute(new AskCommand('질문'))) {
      tokens.push(token);
    }

    // Assert
    const [systemMsg] = mockLlmGatewayService.stream.mock.calls[0][0].messages;
    expect(systemMsg.content).toContain('[커스텀]');
  });

  it('GetActivePromptUseCase를 RAG_PROMPT_NAME으로 호출한다', async () => {
    // Arrange
    mockLlmGatewayService.stream.mockReturnValue(asyncGen([]));

    // Act
    for await (const _ of useCase.execute(new AskCommand('질문'))) {
      /* drain */
    }

    // Assert
    expect(mockGetActivePrompt.execute).toHaveBeenCalledWith(
      'rag-qa-system',
      undefined,
    );
  });

  it('useHyde=true 명령이면 HybridSearchCommand에 useHyde=true를 전달한다', async () => {
    // Arrange
    mockLlmGatewayService.stream.mockReturnValue(asyncGen(['응답']));

    // Act
    for await (const _ of useCase.execute(
      new AskCommand('질문', 5, undefined, true),
    )) {
      /* drain */
    }

    // Assert
    expect(mockHybridSearch.execute).toHaveBeenCalledWith(
      expect.objectContaining({ useHyde: true }),
    );
  });

  describe('LLM 응답 캐싱', () => {
    it('캐시 HIT 시 LLM을 호출하지 않고 캐시 값을 반환한다', async () => {
      // Arrange
      mockLlmCache.get.mockResolvedValue('캐시된 전체 응답');

      // Act
      const tokens: string[] = [];
      for await (const token of useCase.execute(new AskCommand('질문'))) {
        tokens.push(token);
      }

      // Assert
      expect(tokens).toEqual([
        expect.stringContaining('__SOURCES:'),
        '캐시된 전체 응답',
      ]);
      expect(mockLlmGatewayService.stream).not.toHaveBeenCalled();
    });

    it('캐시 MISS 시 LLM을 호출하고 응답을 캐시에 저장한다', async () => {
      // Arrange
      mockLlmCache.get.mockResolvedValue(null);
      mockLlmGatewayService.stream.mockReturnValue(
        asyncGen(['토큰1', '토큰2']),
      );

      // Act
      const tokens: string[] = [];
      for await (const token of useCase.execute(new AskCommand('질문'))) {
        tokens.push(token);
      }

      // Assert
      expect(tokens).toEqual([
        expect.stringContaining('__SOURCES:'),
        '토큰1',
        '토큰2',
      ]);
      expect(mockLlmGatewayService.stream).toHaveBeenCalledTimes(1);
      expect(mockLlmCache.setWithTtl).toHaveBeenCalledWith(
        expect.stringMatching(/^llm:cache:/),
        '토큰1토큰2',
        3600,
      );
    });

    it('동일한 질문과 청크로 일관된 캐시 키를 생성한다', async () => {
      // Arrange
      mockLlmCache.get.mockResolvedValue(null);
      mockLlmGatewayService.stream.mockReturnValue(asyncGen(['응답']));

      // Act — 같은 질문으로 두 번 실행
      for await (const _ of useCase.execute(new AskCommand('질문'))) {
        /* drain */
      }
      for await (const _ of useCase.execute(new AskCommand('질문'))) {
        /* drain */
      }

      // Assert — 두 번 모두 동일한 키로 캐시 조회
      expect(mockLlmCache.get).toHaveBeenNthCalledWith(
        1,
        mockLlmCache.get.mock.calls[0][0],
      );
      expect(mockLlmCache.get).toHaveBeenNthCalledWith(
        2,
        mockLlmCache.get.mock.calls[0][0],
      );
    });
  });

  describe('시맨틱 캐싱', () => {
    it('정확매칭 캐시 HIT 시 시맨틱 캐시는 조회하지 않는다', async () => {
      // Arrange
      mockLlmCache.get.mockResolvedValue('캐시된 전체 응답');

      // Act
      const tokens: string[] = [];
      for await (const token of useCase.execute(new AskCommand('질문'))) {
        tokens.push(token);
      }

      // Assert
      expect(tokens).toEqual([
        expect.stringContaining('__SOURCES:'),
        '캐시된 전체 응답',
      ]);
      expect(mockSemanticCache.findSimilar).not.toHaveBeenCalled();
    });

    it('정확매칭 캐시 MISS 시 시맨틱 캐시 HIT이면 LLM을 호출하지 않고 시맨틱 캐시 값을 반환한다', async () => {
      // Arrange
      mockSemanticCache.findSimilar.mockResolvedValue({
        answer: '시맨틱 캐시 응답',
        score: 0.9,
      });

      // Act
      const tokens: string[] = [];
      for await (const token of useCase.execute(new AskCommand('질문'))) {
        tokens.push(token);
      }

      // Assert
      expect(tokens).toEqual([
        expect.stringContaining('__SOURCES:'),
        '시맨틱 캐시 응답',
      ]);
      expect(mockLlmGatewayService.stream).not.toHaveBeenCalled();
    });

    it('정확매칭/시맨틱 캐시 모두 MISS 시 LLM 응답을 두 캐시에 모두 저장한다', async () => {
      // Arrange
      mockLlmGatewayService.stream.mockReturnValue(
        asyncGen(['토큰1', '토큰2']),
      );

      // Act
      const tokens: string[] = [];
      for await (const token of useCase.execute(new AskCommand('질문'))) {
        tokens.push(token);
      }

      // Assert
      expect(tokens).toEqual([
        expect.stringContaining('__SOURCES:'),
        '토큰1',
        '토큰2',
      ]);
      expect(mockLlmGatewayService.stream).toHaveBeenCalledTimes(1);
      expect(mockLlmCache.setWithTtl).toHaveBeenCalledWith(
        expect.stringMatching(/^llm:cache:/),
        '토큰1토큰2',
        3600,
      );
      expect(mockSemanticCache.store).toHaveBeenCalledWith(
        [0.1, 0.2],
        '질문',
        '토큰1토큰2',
        3600,
        'default',
      );
    });
  });
});
