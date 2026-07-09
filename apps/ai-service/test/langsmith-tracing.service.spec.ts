import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  LangSmithTracingService,
  LlmRunParams,
} from '../src/llm-gateway/application/langsmith-tracing.service';

const mockParams: LlmRunParams = {
  name: 'llm-gateway',
  messages: [{ role: 'user', content: '질문' }],
  answer: '답변',
  model: 'claude-sonnet-4-6',
  completionTokens: 10,
  feature: 'rag-qa',
  tenant: 'default',
  startTime: Date.now() - 100,
  endTime: Date.now(),
};

async function buildService(
  env: Record<string, string>,
): Promise<LangSmithTracingService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      LangSmithTracingService,
      {
        provide: ConfigService,
        useValue: { get: (key: string) => env[key] },
      },
    ],
  }).compile();
  return module.get<LangSmithTracingService>(LangSmithTracingService);
}

describe('LangSmithTracingService', () => {
  it('LANGSMITH_TRACING=false 시 logLlmRun이 no-op으로 동작한다', async () => {
    const service = await buildService({ LANGSMITH_TRACING: 'false' });
    await expect(service.logLlmRun(mockParams)).resolves.toBeUndefined();
  });

  it('LANGSMITH_API_KEY 미설정 시 logLlmRun이 no-op으로 동작한다', async () => {
    const service = await buildService({ LANGSMITH_TRACING: 'true' });
    await expect(service.logLlmRun(mockParams)).resolves.toBeUndefined();
  });

  it('Client 내부 오류 시에도 에러를 throw하지 않는다', async () => {
    const service = await buildService({
      LANGSMITH_TRACING: 'true',
      LANGSMITH_API_KEY: 'test-key',
      LANGSMITH_PROJECT: 'test-project',
    });

    const warnSpy = jest
      .spyOn(service['logger'], 'warn')
      .mockImplementation(() => {});

    await expect(service.logLlmRun(mockParams)).resolves.toBeUndefined();
    warnSpy.mockRestore();
  });
});
