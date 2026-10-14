import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AnswerFeedbackProxyController } from './answer-feedback-proxy.controller';
import { AiServicePyHttpService } from './ai-service-py-http.service';
import { GatewayAuthGuard } from '../../auth/gateway-auth.guard';

const SESSION_UUID = 'user-uuid-1';

describe('AnswerFeedbackProxyController', () => {
  let app: INestApplication;
  let mockAiServicePy: any;

  beforeEach(async () => {
    mockAiServicePy = {
      post: jest.fn().mockResolvedValue({ sessionId: 's-1', turnIndex: 1 }),
      get: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AnswerFeedbackProxyController],
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const validBody = {
    sessionId: 's-1',
    turnIndex: 1,
    accuracy: 5,
    helpfulness: 4,
    comment: '도움이 됐다',
  };

  describe('POST /ai/feedback', () => {
    it('평가를 ai-service-py로 넘기고 userId는 인증 세션에서 채운다', async () => {
      const res = await request(app.getHttpServer()).post('/ai/feedback').send(validBody);

      expect(res.status).toBe(201);
      expect(mockAiServicePy.post).toHaveBeenCalledWith({
        method: 'rag/feedback',
        data: expect.objectContaining({ sessionId: 's-1', turnIndex: 1 }),
        params: { userId: SESSION_UUID },
      });
    });

    it('본문에 userId를 넣어도 무시한다 — 남의 이름으로 평가를 남길 수 없다', async () => {
      await request(app.getHttpServer())
        .post('/ai/feedback')
        .send({ ...validBody, userId: '남의-uuid' });

      const [call] = mockAiServicePy.post.mock.calls;
      expect(call[0].params).toEqual({ userId: SESSION_UUID });
      expect(call[0].data).not.toHaveProperty('userId');
    });

    it('평가값이 범위를 벗어나면 400으로 막고 뒤로 넘기지 않는다', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/feedback')
        .send({ ...validBody, accuracy: 6 });

      expect(res.status).toBe(400);
      expect(mockAiServicePy.post).not.toHaveBeenCalled();
    });

    it('sessionId가 비면 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/feedback')
        .send({ ...validBody, sessionId: '' });

      expect(res.status).toBe(400);
      expect(mockAiServicePy.post).not.toHaveBeenCalled();
    });

    it('turnIndex가 음수면 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/feedback')
        .send({ ...validBody, turnIndex: -1 });

      expect(res.status).toBe(400);
    });

    it('의견은 없어도 통과한다', async () => {
      const { comment, ...withoutComment } = validBody;

      const res = await request(app.getHttpServer())
        .post('/ai/feedback')
        .send(withoutComment);

      expect(res.status).toBe(201);
    });
  });

  describe('GET /ai/feedback', () => {
    it('세션의 내 평가만 조회한다', async () => {
      const res = await request(app.getHttpServer()).get('/ai/feedback?sessionId=s-1');

      expect(res.status).toBe(200);
      expect(mockAiServicePy.get).toHaveBeenCalledWith({
        method: 'rag/feedback',
        params: { sessionId: 's-1', userId: SESSION_UUID },
      });
    });
  });

  describe('DELETE /ai/feedback', () => {
    it('sessionId와 turnIndex로 내 평가를 삭제하고 204를 반환한다', async () => {
      const res = await request(app.getHttpServer()).delete(
        '/ai/feedback?sessionId=s-1&turnIndex=1',
      );

      expect(res.status).toBe(204);
      expect(mockAiServicePy.delete).toHaveBeenCalledWith({
        method: 'rag/feedback',
        params: { sessionId: 's-1', turnIndex: 1, userId: SESSION_UUID },
      });
    });

    it('turnIndex가 숫자가 아니면 400으로 막는다', async () => {
      const res = await request(app.getHttpServer()).delete(
        '/ai/feedback?sessionId=s-1&turnIndex=invalid',
      );

      expect(res.status).toBe(400);
      expect(mockAiServicePy.delete).not.toHaveBeenCalled();
    });

    it('turnIndex가 누락되면 400으로 막는다', async () => {
      const res = await request(app.getHttpServer()).delete(
        '/ai/feedback?sessionId=s-1',
      );

      expect(res.status).toBe(400);
      expect(mockAiServicePy.delete).not.toHaveBeenCalled();
    });

    it('다른 사용자의 세션이거나 존재하지 않는 세션/턴으로 ai-service-py가 404를 반환하면 404를 반환한다', async () => {
      mockAiServicePy.delete.mockRejectedValueOnce(
        new NotFoundException('피드백 또는 세션을 찾을 수 없습니다'),
      );

      const res = await request(app.getHttpServer()).delete(
        '/ai/feedback?sessionId=other-user-session&turnIndex=1',
      );

      expect(res.status).toBe(404);
      expect(mockAiServicePy.delete).toHaveBeenCalledWith({
        method: 'rag/feedback',
        params: { sessionId: 'other-user-session', turnIndex: 1, userId: SESSION_UUID },
      });
    });

    it('ai-service-py에서 400 Bad Request가 발생하면 400을 반환한다', async () => {
      mockAiServicePy.delete.mockRejectedValueOnce(
        new BadRequestException('어시스턴트 답변이 아닌 턴입니다'),
      );

      const res = await request(app.getHttpServer()).delete(
        '/ai/feedback?sessionId=s-1&turnIndex=0',
      );

      expect(res.status).toBe(400);
      expect(mockAiServicePy.delete).toHaveBeenCalledWith({
        method: 'rag/feedback',
        params: { sessionId: 's-1', turnIndex: 0, userId: SESSION_UUID },
      });
    });
  });
});
