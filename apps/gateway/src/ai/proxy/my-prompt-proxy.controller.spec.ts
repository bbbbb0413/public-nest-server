import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MyPromptProxyController } from './my-prompt-proxy.controller';
import { AiServicePyHttpService } from './ai-service-py-http.service';
import { GatewayAuthGuard } from '../../auth/gateway-auth.guard';

const SESSION_UUID = 'owner-uuid';

describe('MyPromptProxyController', () => {
  let app: INestApplication;
  let mockAiServicePy: any;

  beforeEach(async () => {
    mockAiServicePy = {
      get: jest.fn().mockResolvedValue({}),
      post: jest.fn().mockResolvedValue({ version: 2 }),
      patch: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MyPromptProxyController],
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

  it('GET /ai/my-prompt 는 활성 프롬프트를 사용자 세션의 userId로 조회한다', async () => {
    await request(app.getHttpServer()).get('/ai/my-prompt');

    expect(mockAiServicePy.get).toHaveBeenCalledWith({
      method: 'prompts/rag-qa-system/active',
      params: { userId: SESSION_UUID },
    });
  });

  it('GET /ai/my-prompt/list 는 저장된 개인 프롬프트 목록을 조회한다', async () => {
    await request(app.getHttpServer()).get('/ai/my-prompt/list');

    expect(mockAiServicePy.get).toHaveBeenCalledWith({
      method: 'prompts/rag-qa-system',
      params: { userId: SESSION_UUID },
    });
  });

  it('POST /ai/my-prompt 는 기본적으로 저장 후 즉시 활성화한다', async () => {
    await request(app.getHttpServer())
      .post('/ai/my-prompt')
      .send({ content: '사용자 프롬프트: {{context}}' });

    expect(mockAiServicePy.post).toHaveBeenCalledWith({
      method: 'prompts',
      data: {
        name: 'rag-qa-system',
        content: '사용자 프롬프트: {{context}}',
        variables: ['context'],
        userId: SESSION_UUID,
      },
    });

    expect(mockAiServicePy.patch).toHaveBeenCalledWith({
      method: 'prompts/rag-qa-system/2/activate',
      params: { userId: SESSION_UUID },
    });
  });

  it('POST /ai/my-prompt 에 activate: false 전달 시 저장만 하고 활성화하지 않는다', async () => {
    await request(app.getHttpServer())
      .post('/ai/my-prompt')
      .send({ content: '슬롯 프롬프트: {{context}}', activate: false });

    expect(mockAiServicePy.post).toHaveBeenCalledWith({
      method: 'prompts',
      data: {
        name: 'rag-qa-system',
        content: '슬롯 프롬프트: {{context}}',
        variables: ['context'],
        userId: SESSION_UUID,
      },
    });

    expect(mockAiServicePy.patch).not.toHaveBeenCalled();
  });

  it('PATCH /ai/my-prompt/:version/activate 는 특정 버전 프롬프트를 활성화한다', async () => {
    await request(app.getHttpServer()).patch('/ai/my-prompt/3/activate');

    expect(mockAiServicePy.patch).toHaveBeenCalledWith({
      method: 'prompts/rag-qa-system/3/activate',
      params: { userId: SESSION_UUID },
    });
  });

  it('DELETE /ai/my-prompt 는 활성 프롬프트를 비활성화(기본값으로 초기화)한다', async () => {
    const res = await request(app.getHttpServer()).delete('/ai/my-prompt');

    expect(res.status).toBe(204);
    expect(mockAiServicePy.delete).toHaveBeenCalledWith({
      method: 'prompts/rag-qa-system/active',
      params: { userId: SESSION_UUID },
    });
  });

  it('DELETE /ai/my-prompt/:version 는 특정 버전 프롬프트를 삭제한다', async () => {
    const res = await request(app.getHttpServer()).delete('/ai/my-prompt/2');

    expect(res.status).toBe(204);
    expect(mockAiServicePy.delete).toHaveBeenCalledWith({
      method: 'prompts/rag-qa-system/2',
      params: { userId: SESSION_UUID },
    });
  });
});
