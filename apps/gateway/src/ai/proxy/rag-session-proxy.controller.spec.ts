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
      post: jest.fn().mockResolvedValue({}),
      patch: jest.fn().mockResolvedValue({}),
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

  it('검색어 q 파라미터가 있으면 ai-service-py로 전달한다', async () => {
    await request(app.getHttpServer()).get('/ai/rag/sessions?q=검색어&page=1&limit=10');

    expect(mockAiServicePy.get).toHaveBeenCalledWith({
      method: 'rag/sessions',
      params: { userId: SESSION_UUID, page: '1', limit: '10', q: '검색어' },
    });
  });

  it('검색어 search 파라미터가 오면 q로 정규화하여 전달한다', async () => {
    await request(app.getHttpServer()).get('/ai/rag/sessions?search=검색어');

    expect(mockAiServicePy.get).toHaveBeenCalledWith({
      method: 'rag/sessions',
      params: { userId: SESSION_UUID, q: '검색어' },
    });
  });

  it('bookmarked 필터가 있으면 ai-service-py로 전달한다', async () => {
    await request(app.getHttpServer()).get('/ai/rag/sessions?bookmarked=true');

    expect(mockAiServicePy.get).toHaveBeenCalledWith({
      method: 'rag/sessions',
      params: { userId: SESSION_UUID, bookmarked: 'true' },
    });
  });

  it('세션 북마크 상태를 변경(PATCH)할 때 userId와 함께 전달한다', async () => {
    await request(app.getHttpServer())
      .patch('/ai/rag/sessions/sess-1/bookmark')
      .send({ bookmarked: true });

    expect(mockAiServicePy.patch).toHaveBeenCalledWith({
      method: 'rag/sessions/sess-1/bookmark',
      data: { bookmarked: true },
      params: { userId: SESSION_UUID },
    });
  });

  it('세션 북마크 추가(POST) 및 삭제(DELETE)를 처리한다', async () => {
    await request(app.getHttpServer()).post('/ai/rag/sessions/sess-1/bookmark');
    expect(mockAiServicePy.post).toHaveBeenCalledWith({
      method: 'rag/sessions/sess-1/bookmark',
      params: { userId: SESSION_UUID },
    });

    const res = await request(app.getHttpServer()).delete('/ai/rag/sessions/sess-1/bookmark');
    expect(res.status).toBe(204);
    expect(mockAiServicePy.delete).toHaveBeenCalledWith({
      method: 'rag/sessions/sess-1/bookmark',
      params: { userId: SESSION_UUID },
    });
  });

  it('북마크 목록 조회(GET /ai/rag/bookmarks)를 지원한다', async () => {
    await request(app.getHttpServer()).get('/ai/rag/bookmarks?page=1&limit=20&q=검색');

    expect(mockAiServicePy.get).toHaveBeenCalledWith({
      method: 'rag/bookmarks',
      params: { userId: SESSION_UUID, page: '1', limit: '20', q: '검색' },
    });
  });

  it('답변/세션 북마크 등록(POST /ai/rag/bookmarks)을 지원한다', async () => {
    const payload = { sessionId: 'sess-1', turnIndex: 0, note: '중요한 답변' };
    await request(app.getHttpServer()).post('/ai/rag/bookmarks').send(payload);

    expect(mockAiServicePy.post).toHaveBeenCalledWith({
      method: 'rag/bookmarks',
      data: payload,
      params: { userId: SESSION_UUID },
    });
  });

  it('북마크 삭제(DELETE /ai/rag/bookmarks/:bookmarkId)를 지원한다', async () => {
    const res = await request(app.getHttpServer()).delete('/ai/rag/bookmarks/bm-123');

    expect(res.status).toBe(204);
    expect(mockAiServicePy.delete).toHaveBeenCalledWith({
      method: 'rag/bookmarks/bm-123',
      params: { userId: SESSION_UUID },
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
