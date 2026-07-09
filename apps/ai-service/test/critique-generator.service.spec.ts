import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CritiqueGeneratorService } from '../src/qa/application/critique-generator.service';
import { LlmGatewayService } from '../src/llm-gateway/application/llm-gateway.service';
import { SimilaritySearchResult } from '../src/knowledge/domain/port/vector-store.port';

const meta = { documentId: 'doc-1', fileName: 'test.txt', chunkIndex: 0 };
const mockChunks: SimilaritySearchResult[] = [
  { text: '첫 번째 컨텍스트 내용입니다.', score: 0.9, metadata: meta },
  { text: '두 번째 컨텍스트 내용입니다.', score: 0.85, metadata: meta },
];

async function* fakeStream(tokens: string[]) {
  for (const t of tokens) yield t;
}

describe('CritiqueGeneratorService', () => {
  let service: CritiqueGeneratorService;
  const mockInvoke = jest.fn();
  const mockStream = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    mockInvoke.mockResolvedValue({
      answered: true,
      missing: [],
      nextQuery: '',
      confidence: 0.95,
    });

    mockStream.mockReturnValue(
      fakeStream([
        '{"answered":true,"missing":[],"nextQuery":"","confidence":0.8}',
      ]),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CritiqueGeneratorService,
        {
          provide: LlmGatewayService,
          useValue: { stream: mockStream },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'OPENAI_API_KEY' ? 'test-key' : undefined,
          },
        },
      ],
    }).compile();

    service = module.get<CritiqueGeneratorService>(CritiqueGeneratorService);
    (service as any).structuredModel = { invoke: mockInvoke };
  });

  it('withStructuredOutput 모델로 Critique를 생성한다', async () => {
    const critique = await service.generate('질문', '답변', mockChunks);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(critique.isSatisfied(0.9)).toBe(true);
    expect(critique.getConfidence()).toBe(0.95);
  });

  it('structuredModel.invoke 실패 시 LlmGatewayService 스트리밍으로 폴백한다', async () => {
    mockInvoke.mockRejectedValue(new Error('LLM error'));

    const critique = await service.generate('질문', '답변', mockChunks);

    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(critique.isSatisfied(0.0)).toBe(true);
    expect(typeof critique.getConfidence()).toBe('number');
  });

  it('structuredModel이 null이면 LlmGatewayService 스트리밍을 직접 사용한다', async () => {
    (service as any).structuredModel = null;

    const critique = await service.generate('질문', '답변', mockChunks);

    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(typeof critique.getConfidence()).toBe('number');
  });
});
