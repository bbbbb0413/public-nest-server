import { Test, TestingModule } from '@nestjs/testing';
import { RagasEvalConsumer } from '../src/observability/infrastructure/queue/ragas-eval.consumer';
import { RagasEvalService } from '../src/observability/application/ragas-eval.service';

const mockRagasEvalService = { evaluate: jest.fn() };

describe('RagasEvalConsumer', () => {
  let consumer: RagasEvalConsumer;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagasEvalConsumer,
        { provide: RagasEvalService, useValue: mockRagasEvalService },
      ],
    }).compile();

    consumer = module.get<RagasEvalConsumer>(RagasEvalConsumer);
  });

  it('잡 수신 시 RagasEvalService.evaluate()에 위임한다', async () => {
    // Arrange
    const payload = {
      traceId: 'trace-123',
      question: '질문',
      answer: '답변',
      contexts: ['컨텍스트1'],
    };
    const job = { data: payload } as any;

    // Act
    await consumer.process(job);

    // Assert
    expect(mockRagasEvalService.evaluate).toHaveBeenCalledWith(payload);
  });

  it('evaluate가 실패해도 에러를 전파한다', async () => {
    // Arrange
    const error = new Error('평가 실패');
    mockRagasEvalService.evaluate.mockRejectedValue(error);
    const job = {
      data: { traceId: 'trace-456', question: 'q', answer: 'a', contexts: [] },
    } as any;

    // Act & Assert
    await expect(consumer.process(job)).rejects.toThrow('평가 실패');
  });
});
