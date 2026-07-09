import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RagasEvalService } from '../src/observability/application/ragas-eval.service';
import { RagasEvaluationRepositoryImpl } from '../src/observability/infrastructure/persistence/ragas-evaluation.repository-impl';
import { RagasEvalPayload } from '../src/observability/application/ragas-eval.payload';

const mockRepo = { persist: jest.fn() };

function buildConfig(env: Record<string, string>) {
  return { get: (key: string) => env[key] };
}

async function buildService(
  env: Record<string, string>,
): Promise<RagasEvalService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      RagasEvalService,
      { provide: RagasEvaluationRepositoryImpl, useValue: mockRepo },
      { provide: ConfigService, useValue: buildConfig(env) },
    ],
  }).compile();
  return module.get<RagasEvalService>(RagasEvalService);
}

describe('RagasEvalService — 휴리스틱 모드 (RAGAS_LLM_EVAL_ENABLED=false)', () => {
  let service: RagasEvalService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await buildService({ RAGAS_LLM_EVAL_ENABLED: 'false' });
  });

  it('evaluate 호출 시 평가 결과를 리포지토리에 적재한다', async () => {
    const payload: RagasEvalPayload = {
      traceId: 'trace-123',
      question: '테스트 질문',
      answer: '테스트 답변',
      contexts: ['컨텍스트1', '컨텍스트2'],
    };

    await service.evaluate(payload);

    expect(mockRepo.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'trace-123',
        question: '테스트 질문',
        sampledAt: expect.any(Date),
      }),
    );
  });

  it('evaluate는 traceId, question, faithfulness, sampledAt을 포함한 문서를 적재한다', async () => {
    const payload: RagasEvalPayload = {
      traceId: 'trace-789',
      question: '질문',
      answer: '답변',
      contexts: ['ctx'],
    };

    await service.evaluate(payload);

    const [persisted] = mockRepo.persist.mock.calls[0];
    expect(typeof persisted.faithfulness).toBe('number');
    expect(persisted.faithfulness).toBeGreaterThanOrEqual(0);
    expect(persisted.faithfulness).toBeLessThanOrEqual(1);
  });
});

describe('RagasEvalService — LLM 평가 모드 (RAGAS_LLM_EVAL_ENABLED=true)', () => {
  let service: RagasEvalService;
  const mockInvoke = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    mockInvoke.mockResolvedValue({
      faithfulness: 0.9,
      answerRelevancy: 0.85,
      contextPrecision: 0.8,
    });

    jest.mock('@langchain/openai', () => ({
      ChatOpenAI: jest.fn().mockImplementation(() => ({
        withStructuredOutput: jest.fn().mockReturnValue({ invoke: mockInvoke }),
      })),
    }));

    service = await buildService({
      RAGAS_LLM_EVAL_ENABLED: 'true',
      OPENAI_API_KEY: 'test-openai-key',
    });

    (service as any).llmEval = { invoke: mockInvoke };
  });

  it('LLM 평가 모드에서 structuredModel.invoke 결과를 리포지토리에 적재한다', async () => {
    const payload: RagasEvalPayload = {
      traceId: 'llm-trace-1',
      question: '질문',
      answer: '답변',
      contexts: ['ctx1', 'ctx2'],
    };

    await service.evaluate(payload);

    const [persisted] = mockRepo.persist.mock.calls[0];
    expect(persisted.traceId).toBe('llm-trace-1');
    expect(persisted.faithfulness).toBe(0.9);
    expect(persisted.answerRelevancy).toBe(0.85);
    expect(persisted.contextPrecision).toBe(0.8);
  });

  it('LLM 호출 실패 시 휴리스틱으로 폴백하여 persist를 호출한다', async () => {
    mockInvoke.mockRejectedValue(new Error('LLM error'));

    const payload: RagasEvalPayload = {
      traceId: 'fallback-trace',
      question: '질문',
      answer: '답변',
      contexts: ['ctx'],
    };

    await service.evaluate(payload);

    expect(mockRepo.persist).toHaveBeenCalledTimes(1);
    const [persisted] = mockRepo.persist.mock.calls[0];
    expect(persisted.traceId).toBe('fallback-trace');
    expect(typeof persisted.faithfulness).toBe('number');
  });
});
