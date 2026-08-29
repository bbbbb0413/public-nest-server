import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RagSessionProxyController } from './rag-session-proxy.controller';
import { AiServicePyHttpService } from './ai-service-py-http.service';
import { GatewayAuthGuard } from '../../auth/gateway-auth.guard';

const SESSION_UUID = 'owner-uuid';

describe('RagSessionProxyController', () => {
  let app: INestApplication;
  let mockAiServicePy: any;

  beforeEach(async () => {
    mockAiServicePy = {
      get: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RagSessionProxyController],
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

  it('세션 목록은 인증 세션의 userId로 조회한다', async () => {
    await request(app.getHttpServer()).get('/ai/rag/sessions?page=1&limit=10');

    expect(mockAiServicePy.get).toHaveBeenCalledWith({
      method: 'rag/sessions',
      params: { userId: SESSION_UUID, page: '1', limit: '10' },
    });
  });

  it('세션 상세 조회에 userId를 함께 보낸다 — 없으면 소유자를 가릴 수 없다', async () => {
    await request(app.getHttpServer()).get('/ai/rag/sessions/sess-1');

    expect(mockAiServicePy.get).toHaveBeenCalledWith({
      method: 'rag/sessions/sess-1',
      params: { userId: SESSION_UUID },
    });
  });

  it('세션 삭제에 userId를 함께 보낸다', async () => {
    const res = await request(app.getHttpServer()).delete('/ai/rag/sessions/sess-1');

    expect(res.status).toBe(204);
    expect(mockAiServicePy.delete).toHaveBeenCalledWith({
      method: 'rag/sessions/sess-1',
      params: { userId: SESSION_UUID },
    });
  });

  it('클라이언트가 보낸 userId 쿼리는 쓰지 않는다', async () => {
    await request(app.getHttpServer()).get('/ai/rag/sessions/sess-1?userId=침입자');

    const [call] = mockAiServicePy.get.mock.calls;
    expect(call[0].params).toEqual({ userId: SESSION_UUID });
  });
});
