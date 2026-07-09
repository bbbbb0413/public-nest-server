import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AgenticAskUseCase } from '../src/qa/application/agentic-ask.use-case';
import { AgenticAskCommand } from '../src/qa/application/command/agentic-ask.command';
import { HybridSearchUseCase } from '../src/qa/application/hybrid-search.use-case';
import { LlmGatewayService } from '../src/llm-gateway/application/llm-gateway.service';
import { GetActivePromptUseCase } from '../src/prompt/application/get-active-prompt.use-case';
import { CritiqueGeneratorService } from '../src/qa/application/critique-generator.service';
import { QueryRefinerService } from '../src/qa/application/query-refiner.service';
import { RagContentValidator } from '../src/qa/application/filter/rag-content-validator';
import { SecretPiiScanner } from '../src/qa/application/filter/secret-pii-scanner';
import { IterationBudget } from '../src/qa/domain/vo/iteration-budget.vo';
import { Critique } from '../src/qa/domain/vo/critique.vo';
import { PromptTemplate } from '../src/prompt/domain/model/prompt-template';

async function* asyncGen(values: string[]) {
  for (const v of values) yield v;
}

const defaultChunks = [
  {
    text: '검색된 문서 내용',
    score: 0.9,
    metadata: { documentId: 'doc-1', fileName: 'docs.txt', chunkIndex: 0 },
  },
];

const mockHybridSearch = { execute: jest.fn() };
const mockLlmGateway = { stream: jest.fn() };
const mockGetActivePrompt = { execute: jest.fn() };
const mockCritiqueGenerator = { generate: jest.fn() };
const mockQueryRefiner = { refine: jest.fn() };
const mockRagContentValidator = { sanitize: jest.fn() };
const mockSecretPiiScanner = {
  mask: jest.fn().mockImplementation((text: string) => text),
};
const mockConfigService = { get: jest.fn().mockReturnValue(undefined) };

const defaultPrompt = PromptTemplate.create({
  name: 'rag-qa-system',
  content: '컨텍스트:\n{{context}}',
  variables: ['context'],
});

describe('AgenticAskUseCase', () => {
  let useCase: AgenticAskUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgenticAskUseCase,
        { provide: HybridSearchUseCase, useValue: mockHybridSearch },
        { provide: LlmGatewayService, useValue: mockLlmGateway },
        { provide: GetActivePromptUseCase, useValue: mockGetActivePrompt },
        { provide: CritiqueGeneratorService, useValue: mockCritiqueGenerator },
        { provide: QueryRefinerService, useValue: mockQueryRefiner },
        { provide: RagContentValidator, useValue: mockRagContentValidator },
        { provide: SecretPiiScanner, useValue: mockSecretPiiScanner },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    useCase = module.get<AgenticAskUseCase>(AgenticAskUseCase);

    mockGetActivePrompt.execute.mockResolvedValue(defaultPrompt);
    mockHybridSearch.execute.mockResolvedValue({
      queryEmbedding: [0.1, 0.2],
      chunks: defaultChunks,
    });
    mockLlmGateway.stream.mockReturnValue(asyncGen(['최종', '답변']));
    mockRagContentValidator.sanitize.mockImplementation(
      (chunks: unknown) => chunks,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('confidence>=0.8 시 1회 반복 후 답변을 yield하고 종료한다', async () => {
    // Arrange
    const budget = IterationBudget.of(5, 30000, 45000);
    const command = new AgenticAskCommand(
      '복잡한 질문',
      5,
      undefined,
      budget,
      0.8,
    );
    mockCritiqueGenerator.generate.mockResolvedValue(
      Critique.of(true, [], '', 0.9),
    );

    // Act
    const tokens: string[] = [];
    for await (const token of useCase.execute(command)) {
      tokens.push(token);
    }

    // Assert — __SOURCES: 먼저 yield, 이후 LLM 토큰을 join 후 마스킹하여 단일 문자열로 yield
    expect(tokens).toEqual([expect.stringContaining('__SOURCES:'), '최종답변']);
    expect(mockHybridSearch.execute).toHaveBeenCalledTimes(1);
    expect(mockCritiqueGenerator.generate).toHaveBeenCalledTimes(1);
  });

  it('confidence 미달 시 nextQuery로 재검색한다', async () => {
    // Arrange
    const budget = IterationBudget.of(5, 30000, 45000);
    const command = new AgenticAskCommand(
      '복잡한 질문',
      5,
      undefined,
      budget,
      0.8,
    );

    mockCritiqueGenerator.generate
      .mockResolvedValueOnce(
        Critique.of(false, ['누락 정보'], '보완된 질의', 0.5),
      )
      .mockResolvedValueOnce(Critique.of(true, [], '', 0.9));
    mockQueryRefiner.refine.mockReturnValue('보완된 질의');

    // Act
    const tokens: string[] = [];
    for await (const token of useCase.execute(command)) {
      tokens.push(token);
    }

    // Assert
    expect(mockHybridSearch.execute).toHaveBeenCalledTimes(2);
    expect(mockHybridSearch.execute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ question: '보완된 질의' }),
    );
  });

  it('예산 소진(maxIterations 도달) 시 마지막 답변을 yield하고 강제 종료한다', async () => {
    // Arrange
    const budget = IterationBudget.of(2, 30000, 45000);
    const command = new AgenticAskCommand(
      '복잡한 질문',
      5,
      undefined,
      budget,
      0.8,
    );
    mockCritiqueGenerator.generate.mockResolvedValue(
      Critique.of(false, ['계속 누락'], '계속 재검색', 0.3),
    );
    mockQueryRefiner.refine.mockReturnValue('계속 재검색');

    // Act
    const tokens: string[] = [];
    for await (const token of useCase.execute(command)) {
      tokens.push(token);
    }

    // Assert — maxIterations=2이므로 2회만 검색 후 종료
    expect(mockHybridSearch.execute).toHaveBeenCalledTimes(2);
    expect(tokens.length).toBeGreaterThan(0);
  });

  it('HybridSearchUseCase를 검색 도구로 위임한다', async () => {
    // Arrange
    const budget = IterationBudget.of(5, 30000, 45000);
    const command = new AgenticAskCommand(
      '테스트 질문',
      7,
      'tenant-a',
      budget,
      0.8,
    );
    mockCritiqueGenerator.generate.mockResolvedValue(
      Critique.of(true, [], '', 0.95),
    );

    // Act
    for await (const _ of useCase.execute(command)) {
      /* drain */
    }

    // Assert
    expect(mockHybridSearch.execute).toHaveBeenCalledWith(
      expect.objectContaining({ question: '테스트 질문', topK: 7 }),
    );
  });

  it('SecretPiiScanner로 최종 답변을 마스킹한다', async () => {
    // Arrange
    const budget = IterationBudget.of(5, 30000, 45000);
    const command = new AgenticAskCommand('질문', 5, undefined, budget, 0.8);
    mockCritiqueGenerator.generate.mockResolvedValue(
      Critique.of(true, [], '', 0.9),
    );
    mockSecretPiiScanner.mask.mockReturnValue('마스킹된 답변');

    // Act
    const tokens: string[] = [];
    for await (const token of useCase.execute(command)) {
      tokens.push(token);
    }

    // Assert
    expect(mockSecretPiiScanner.mask).toHaveBeenCalledWith('최종답변');
    expect(tokens).toEqual([
      expect.stringContaining('__SOURCES:'),
      '마스킹된 답변',
    ]);
  });
});
