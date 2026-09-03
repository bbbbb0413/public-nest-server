import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PromptProxyController } from './prompt-proxy.controller';
import { AiServicePyHttpService } from './ai-service-py-http.service';
import { GatewayAuthGuard } from '../../auth/gateway-auth.guard';
import { AdminGuard } from '../../auth/admin.guard';

describe('PromptProxyController', () => {
  let app: INestApplication;
  let mockAiServicePy: any;
  let currentUser: any = null;

  beforeEach(async () => {
    mockAiServicePy = {
      post: jest.fn().mockResolvedValue({ id: 'p-1', name: 'rag-qa-system', version: 1 }),
      get: jest.fn().mockResolvedValue([]),
      patch: jest.fn().mockResolvedValue({ id: 'p-1', name: 'rag-qa-system', version: 1, isActive: true }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PromptProxyController],
      providers: [
        { provide: AiServicePyHttpService, useValue: mockAiServicePy },
        AdminGuard,
      ],
    })
      .overrideGuard(GatewayAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = currentUser;
          req.session = currentUser ? { uuid: currentUser.uuid ?? String(currentUser.id) } : null;
          return !!currentUser;
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

  describe('POST /ai/prompts (전역 프롬프트 버전 생성)', () => {
    it('관리자 권한이 있는 경우 프롬프트 생성을 허용한다', async () => {
      currentUser = {
        id: 1,
        name: 'Admin User',
        email: 'admin@test.com',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer())
        .post('/ai/prompts')
        .send({ name: 'rag-qa-system', content: '시스템 지시문', variables: [] });

      expect(res.status).toBe(201);
      expect(mockAiServicePy.post).toHaveBeenCalledWith({
        method: 'prompts',
        data: expect.objectContaining({ name: 'rag-qa-system', content: '시스템 지시문' }),
      });
    });

    it('일반 사용자(관리자 권한 없음)의 경우 403 Forbidden을 반환한다', async () => {
      currentUser = {
        uuid: 'user-uuid-1',
        nickName: 'NormalUser',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer())
        .post('/ai/prompts')
        .send({ name: 'rag-qa-system', content: '시스템 지시문' });

      expect(res.status).toBe(403);
      expect(mockAiServicePy.post).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /ai/prompts/:name/:version/activate (전역 프롬프트 버전 활성화)', () => {
    it('관리자 권한이 있는 경우 전역 프롬프트 활성화를 허용한다', async () => {
      currentUser = {
        id: 1,
        name: 'Admin User',
        email: 'admin@test.com',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer())
        .patch('/ai/prompts/rag-qa-system/1/activate');

      expect(res.status).toBe(200);
      expect(mockAiServicePy.patch).toHaveBeenCalledWith({
        method: 'prompts/rag-qa-system/1/activate',
      });
    });

    it('일반 사용자(관리자 권한 없음)의 경우 403 Forbidden을 반환한다', async () => {
      currentUser = {
        uuid: 'user-uuid-1',
        nickName: 'NormalUser',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer())
        .patch('/ai/prompts/rag-qa-system/1/activate');

      expect(res.status).toBe(403);
      expect(mockAiServicePy.patch).not.toHaveBeenCalled();
    });
  });

  describe('GET /ai/prompts/:name (버전 목록 조회)', () => {
    it('인증된 사용자의 조회를 허용한다', async () => {
      currentUser = {
        uuid: 'user-uuid-1',
        nickName: 'NormalUser',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer()).get('/ai/prompts/rag-qa-system');

      expect(res.status).toBe(200);
      expect(mockAiServicePy.get).toHaveBeenCalledWith({
        method: 'prompts/rag-qa-system',
      });
    });
  });

  describe('GET /ai/prompts/:name/active (활성 버전 조회)', () => {
    it('인증된 사용자의 활성 버전 조회를 허용한다', async () => {
      currentUser = {
        uuid: 'user-uuid-1',
        nickName: 'NormalUser',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer()).get('/ai/prompts/rag-qa-system/active');

      expect(res.status).toBe(200);
      expect(mockAiServicePy.get).toHaveBeenCalledWith({
        method: 'prompts/rag-qa-system/active',
        params: { userId: undefined },
      });
    });
  });
});
