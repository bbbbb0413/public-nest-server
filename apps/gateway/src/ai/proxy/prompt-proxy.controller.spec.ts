import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PromptProxyController } from './prompt-proxy.controller';
import { AiServicePyHttpService } from './ai-service-py-http.service';
import { GatewayAuthGuard } from '../../auth/gateway-auth.guard';

const SESSION_UUID = 'owner-uuid';

describe('PromptProxyController', () => {
  let app: INestApplication;
  let mockAiServicePy: any;

  beforeEach(async () => {
    mockAiServicePy = {
      get: jest.fn().mockResolvedValue([]),
      post: jest.fn().mockResolvedValue({ version: 1 }),
      patch: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PromptProxyController],
      providers: [{ provide: AiServicePyHttpService, useValue: mockAiServicePy }],
    })
      .overrideGuard(GatewayAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().session = { uuid: SESSION_UUID };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /ai/prompts/:name 호출 시 세션의 userId를 전달하여 타인의 개인 프롬프트가 노출되지 않도록 한다', async () => {
    await request(app.getHttpServer()).get('/ai/prompts/rag-qa-system');

    expect(mockAiServicePy.get).toHaveBeenCalledWith({
      method: 'prompts/rag-qa-system',
      params: { userId: SESSION_UUID },
    });
  });

  it('GET /ai/prompts/:name/active 호출 시 세션의 userId를 전달한다', async () => {
    await request(app.getHttpServer()).get('/ai/prompts/rag-qa-system/active');

    expect(mockAiServicePy.get).toHaveBeenCalledWith({
      method: 'prompts/rag-qa-system/active',
      params: { userId: SESSION_UUID },
    });
  });

  it('PATCH /ai/prompts/:name/:version/activate 호출 시 세션의 userId를 전달한다', async () => {
    await request(app.getHttpServer()).patch('/ai/prompts/rag-qa-system/1/activate');

    expect(mockAiServicePy.patch).toHaveBeenCalledWith({
      method: 'prompts/rag-qa-system/1/activate',
      params: { userId: SESSION_UUID },
    });
  });

  it('POST /ai/prompts 호출 시 세션의 userId를 데이터에 포함한다', async () => {
    await request(app.getHttpServer())
      .post('/ai/prompts')
      .send({
        name: 'rag-qa-system',
        content: '컨텍스트: {{context}}',
        variables: ['context'],
      });

    expect(mockAiServicePy.post).toHaveBeenCalledWith({
      method: 'prompts',
      data: {
        name: 'rag-qa-system',
        content: '컨텍스트: {{context}}',
        variables: ['context'],
        userId: SESSION_UUID,
      },
    });
  });

  it('DELETE /ai/prompts/:name/active 호출 시 활성 프롬프트를 비활성화한다', async () => {
    const res = await request(app.getHttpServer()).delete('/ai/prompts/rag-qa-system/active');

    expect(res.status).toBe(204);
    expect(mockAiServicePy.delete).toHaveBeenCalledWith({
      method: 'prompts/rag-qa-system/active',
      params: { userId: SESSION_UUID },
    });
  });

  it('DELETE /ai/prompts/:name/:version 호출 시 특정 버전 프롬프트를 삭제한다', async () => {
    const res = await request(app.getHttpServer()).delete('/ai/prompts/rag-qa-system/1');

    expect(res.status).toBe(204);
    expect(mockAiServicePy.delete).toHaveBeenCalledWith({
      method: 'prompts/rag-qa-system/1',
      params: { userId: SESSION_UUID },
    });
  });
});
