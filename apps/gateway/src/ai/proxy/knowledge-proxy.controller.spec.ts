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

    it('Content-Disposition이 누락되었으면 기본 파일명(filename="{id}")을 보완한다', async () => {
      mockAiServicePy.getBinary.mockResolvedValue({
        data: Buffer.from('binary-content'),
        contentType: 'application/pdf',
        contentDisposition: undefined,
      });

      const res = await request(app.getHttpServer()).get('/ai/knowledge/documents/doc-test-123/file');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toBe('inline; filename="doc-test-123"');
      expect(res.body).toEqual(Buffer.from('binary-content'));
    });

    it('Content-Disposition에 filename 파라미터가 없으면 기본 파일명(filename="{id}")을 보완한다', async () => {
      mockAiServicePy.getBinary.mockResolvedValue({
        data: Buffer.from('sample content'),
        contentType: 'text/plain',
        contentDisposition: 'attachment',
      });

      const res = await request(app.getHttpServer()).get('/ai/knowledge/documents/doc-456/file');

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toBe('attachment; filename="doc-456"');
    });

    it('Content-Disposition 파일명에 경로 조작이나 안전하지 않은 문자가 포함되어 있으면 기본 파일명으로 대체한다', async () => {
      mockAiServicePy.getBinary.mockResolvedValue({
        data: Buffer.from('safe content'),
        contentType: 'application/octet-stream',
        contentDisposition: 'inline; filename="../../etc/passwd"',
      });

      const res = await request(app.getHttpServer()).get('/ai/knowledge/documents/doc-safe/file');

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toBe('inline; filename="doc-safe"');
    });

    it('Content-Disposition에 개행(CRLF) 인젝션 시도가 있으면 기본 파일명으로 대체한다', async () => {
      mockAiServicePy.getBinary.mockResolvedValue({
        data: Buffer.from('safe content'),
        contentType: 'text/plain',
        contentDisposition: 'inline; filename="a.txt\r\nInjected: malicious"',
      });

      const res = await request(app.getHttpServer()).get('/ai/knowledge/documents/doc-safe/file');

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toBe('inline; filename="doc-safe"');
    });

    it('Content-Disposition에 RFC 5987 UTF-8 인코딩 파일명(filename*=UTF-8\'\'...)이 포함된 경우 원본 헤더를 온전히 유지한다', async () => {
      const utf8Header = "inline; filename*=UTF-8''%ED%85%8C%EC%8A%A4%ED%8A%B8%EB%AC%B8%EC%84%9C.pdf";
      mockAiServicePy.getBinary.mockResolvedValue({
        data: Buffer.from('utf8 content'),
        contentType: 'application/pdf',
        contentDisposition: utf8Header,
      });

      const res = await request(app.getHttpServer()).get('/ai/knowledge/documents/doc-utf8/file');

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toBe(utf8Header);
    });

    it('id 파라미터에 따옴표나 역슬래시 문자가 포함되어 있고 Content-Disposition이 없으면 safeId로 치환된 기본 파일명을 생성한다', async () => {
      mockAiServicePy.getBinary.mockResolvedValue({
        data: Buffer.from('content'),
        contentType: 'application/octet-stream',
        contentDisposition: undefined,
      });

      const res = await request(app.getHttpServer()).get(
        '/ai/knowledge/documents/doc%22%5Cunsafe/file',
      );

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toBe('inline; filename="doc__unsafe"');
    });

    it('Content-Disposition 타입이 attachment이고 파일명에 경로 조작이 포함되어 있으면 attachment 타입을 유지하며 기본 파일명으로 대체한다', async () => {
      mockAiServicePy.getBinary.mockResolvedValue({
        data: Buffer.from('attachment content'),
        contentType: 'application/pdf',
        contentDisposition: 'attachment; filename="../secret.pdf"',
      });

      const res = await request(app.getHttpServer()).get('/ai/knowledge/documents/doc-attach/file');

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toBe('attachment; filename="doc-attach"');
    });

    it('Content-Type이 누락되었거나 비어있으면 기본 Content-Type(application/octet-stream)을 설정한다', async () => {
      mockAiServicePy.getBinary.mockResolvedValue({
        data: Buffer.from('content'),
        contentType: '',
        contentDisposition: 'inline; filename="doc.bin"',
      });

      const res = await request(app.getHttpServer()).get('/ai/knowledge/documents/doc-empty-type/file');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/octet-stream');
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
