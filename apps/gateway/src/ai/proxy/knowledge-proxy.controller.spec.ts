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
});
