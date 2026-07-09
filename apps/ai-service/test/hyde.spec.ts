import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmProvider } from '@libs/llm';
import { HydeService } from '../src/qa/application/hyde.service';

async function* asyncGen(values: string[]) {
  for (const v of values) yield v;
}

describe('HydeService', () => {
  let service: HydeService;
  const mockLlmProvider = { stream: jest.fn() };
  const mockConfigService = { get: jest.fn().mockReturnValue(undefined) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HydeService,
        { provide: LlmProvider, useValue: mockLlmProvider },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<HydeService>(HydeService);
  });

  afterEach(() => jest.clearAllMocks());

  it('LLM 스트리밍 토큰을 합쳐 가설 답변 문자열을 반환한다', async () => {
    mockLlmProvider.stream.mockReturnValue(
      asyncGen(['환불', '은 30일', '이내 가능합니다.']),
    );

    const result = await service.generateHypothetical('환불 정책이 어떻게 되나요?');
    expect(result).toBe('환불은 30일이내 가능합니다.');
    expect(mockLlmProvider.stream).toHaveBeenCalledTimes(1);
  });

  it('단어 수가 maxQueryWords(기본값 5) 이하이면 shouldApply가 true를 반환한다', () => {
    expect(service.shouldApply('환불 정책')).toBe(true);
  });

  it('단어 수가 maxQueryWords 초과이면 shouldApply가 false를 반환한다', () => {
    const longQuery = '환불 정책이 어떻게 되는지 자세하게 알고 싶어요';
    expect(service.shouldApply(longQuery)).toBe(false);
  });

  it('빈 문자열 질문도 처리한다', () => {
    expect(service.shouldApply('')).toBe(true);
  });

  it('HYDE_MAX_QUERY_WORDS 환경변수로 임계값을 조정할 수 있다', async () => {
    mockConfigService.get.mockImplementation((key: string) =>
      key === 'HYDE_MAX_QUERY_WORDS' ? '3' : undefined,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HydeService,
        { provide: LlmProvider, useValue: mockLlmProvider },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    const customService = module.get<HydeService>(HydeService);

    expect(customService.shouldApply('짧은 질문')).toBe(true);
    expect(customService.shouldApply('조금 더 긴 질문입니다')).toBe(false);
  });
});
