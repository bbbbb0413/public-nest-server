import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { KnowledgeProxyController } from './knowledge-proxy.controller';
import { AiServicePyHttpService } from './ai-service-py-http.service';
import { GatewayAuthGuard } from '../../auth/gateway-auth.guard';

describe('KnowledgeProxyController', () => {
  let app: INestApplication;
  let mockAiServicePy: any;

  beforeEach(async () => {
    mockAiServicePy = {
      getBinary: jest.fn(),
      post: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [KnowledgeProxyController],
      providers: [{ provide: AiServicePyHttpService, useValue: mockAiServicePy }],
    })
      .overrideGuard(GatewayAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /ai/knowledge/documents/:id/file', () => {
    it('원본 파일을 Content-Type/Content-Disposition과 함께 그대로 전달한다', async () => {
      mockAiServicePy.getBinary.mockResolvedValue({
        data: Buffer.from('hello world'),
        contentType: 'text/plain',
        contentDisposition: 'inline; filename="a.txt"',
      });

      const res = await request(app.getHttpServer()).get('/ai/knowledge/documents/doc-1/file');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.headers['content-disposition']).toBe('inline; filename="a.txt"');
      expect(res.text).toBe('hello world');
      expect(mockAiServicePy.getBinary).toHaveBeenCalledWith('knowledge/documents/doc-1/file');
    });

    it('원본이 없으면 ai-service-py가 던진 404를 그대로 전달한다', async () => {
      const { HttpException } = await import('@nestjs/common');
      mockAiServicePy.getBinary.mockRejectedValue(
        new HttpException({ detail: '원본 파일을 찾을 수 없습니다: doc-missing' }, 404),
      );

      const res = await request(app.getHttpServer()).get(
        '/ai/knowledge/documents/doc-missing/file',
      );

      expect(res.status).toBe(404);
    });
  });

  describe('POST /ai/knowledge/documents/:id/retry', () => {
    it('재시도 요청 시 aiServicePy.post로 knowledge/documents/:id/retry를 호출하고 결과를 반환한다', async () => {
      const mockResult = {
        id: 'doc-1',
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        status: 'processed',
        chunkCount: 5,
        createdAt: '2026-10-31T01:00:00Z',
      };
      mockAiServicePy.post.mockResolvedValue(mockResult);

      const res = await request(app.getHttpServer()).post(
        '/ai/knowledge/documents/doc-1/retry',
      );

      expect(res.status).toBe(201);
      expect(mockAiServicePy.post).toHaveBeenCalledWith({
        method: 'knowledge/documents/doc-1/retry',
      });
      expect(res.body).toEqual(mockResult);
    });

    it('대상 문서가 없거나 원본 파일이 누락되어 ai-service-py가 404를 던지면 404를 그대로 전달한다', async () => {
      const { HttpException } = await import('@nestjs/common');
      mockAiServicePy.post.mockRejectedValue(
        new HttpException({ detail: '원본 파일을 찾을 수 없습니다: doc-missing' }, 404),
      );

      const res = await request(app.getHttpServer()).post(
        '/ai/knowledge/documents/doc-missing/retry',
      );

      expect(res.status).toBe(404);
      expect(mockAiServicePy.post).toHaveBeenCalledWith({
        method: 'knowledge/documents/doc-missing/retry',
      });
    });

    it('임베딩 실패 등 ai-service-py에서 500 내부 서버 에러가 발생하면 500 에러를 그대로 전달한다', async () => {
      const { HttpException } = await import('@nestjs/common');
      mockAiServicePy.post.mockRejectedValue(
        new HttpException({ detail: '임베딩 모델 호출 실패' }, 500),
      );

      const res = await request(app.getHttpServer()).post(
        '/ai/knowledge/documents/doc-err/retry',
      );

      expect(res.status).toBe(500);
      expect(mockAiServicePy.post).toHaveBeenCalledWith({
        method: 'knowledge/documents/doc-err/retry',
      });
    });
  });
});
