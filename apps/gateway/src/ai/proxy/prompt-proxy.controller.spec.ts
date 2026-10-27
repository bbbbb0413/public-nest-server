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
  let currentUser: any;

  beforeEach(async () => {
    mockAiServicePy = {
      get: jest.fn().mockResolvedValue([]),
      post: jest.fn().mockResolvedValue({ version: 1 }),
      patch: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(undefined),
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
    it('관리자 권한이 있는 경우 세션 uuid 없이 전역 프롬프트 생성을 허용한다', async () => {
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
        data: {
          name: 'rag-qa-system',
          content: '시스템 지시문',
          variables: [],
          userId: undefined,
        },
      });
    });

    it('dto에 userId가 명시된 경우 해당 userId로 생성을 요청한다', async () => {
      currentUser = {
        id: 1,
        name: 'Admin User',
        email: 'admin@test.com',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer())
        .post('/ai/prompts')
        .send({
          name: 'rag-qa-system',
          content: '시스템 지시문',
          variables: [],
          userId: 'custom-user',
        });

      expect(res.status).toBe(201);
      expect(mockAiServicePy.post).toHaveBeenCalledWith({
        method: 'prompts',
        data: {
          name: 'rag-qa-system',
          content: '시스템 지시문',
          variables: [],
          userId: 'custom-user',
        },
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
    it('관리자 권한이 있는 경우 userId 파라미터 없이 전역 프롬프트 활성화를 허용한다', async () => {
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

    it('userId 쿼리가 지정된 경우 params에 userId를 포함하여 활성화를 요청한다', async () => {
      currentUser = {
        id: 1,
        name: 'Admin User',
        email: 'admin@test.com',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer())
        .patch('/ai/prompts/rag-qa-system/1/activate?userId=custom-user');

      expect(res.status).toBe(200);
      expect(mockAiServicePy.patch).toHaveBeenCalledWith({
        method: 'prompts/rag-qa-system/1/activate',
        params: { userId: 'custom-user' },
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
    it('관리자 권한이 있는 경우 userId 쿼리가 없으면 params 없이 조회를 요청한다', async () => {
      currentUser = {
        id: 1,
        name: 'Admin User',
        email: 'admin@test.com',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer()).get('/ai/prompts/rag-qa-system');

      expect(res.status).toBe(200);
      expect(mockAiServicePy.get).toHaveBeenCalledWith({
        method: 'prompts/rag-qa-system',
      });
    });

    it('관리자 권한이 있는 경우 userId 쿼리가 지정되면 params에 userId를 포함하여 전달한다', async () => {
      currentUser = {
        id: 1,
        name: 'Admin User',
        email: 'admin@test.com',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer()).get('/ai/prompts/rag-qa-system?userId=target-user');

      expect(res.status).toBe(200);
      expect(mockAiServicePy.get).toHaveBeenCalledWith({
        method: 'prompts/rag-qa-system',
        params: { userId: 'target-user' },
      });
    });

    it('일반 사용자(관리자 권한 없음)의 경우 403 Forbidden을 반환한다', async () => {
      currentUser = {
        uuid: 'user-uuid-1',
        nickName: 'NormalUser',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer()).get('/ai/prompts/rag-qa-system');

      expect(res.status).toBe(403);
      expect(mockAiServicePy.get).not.toHaveBeenCalled();
    });
  });

  describe('GET /ai/prompts/:name/active (활성 버전 조회)', () => {
    it('관리자 권한이 있는 경우 userId 쿼리가 없으면 params 없이 조회를 요청한다', async () => {
      currentUser = {
        id: 1,
        name: 'Admin User',
        email: 'admin@test.com',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer()).get('/ai/prompts/rag-qa-system/active');

      expect(res.status).toBe(200);
      expect(mockAiServicePy.get).toHaveBeenCalledWith({
        method: 'prompts/rag-qa-system/active',
      });
    });

    it('관리자 권한이 있는 경우 userId 쿼리가 지정되면 params에 userId를 포함하여 전달한다', async () => {
      currentUser = {
        id: 1,
        name: 'Admin User',
        email: 'admin@test.com',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer()).get('/ai/prompts/rag-qa-system/active?userId=target-user');

      expect(res.status).toBe(200);
      expect(mockAiServicePy.get).toHaveBeenCalledWith({
        method: 'prompts/rag-qa-system/active',
        params: { userId: 'target-user' },
      });
    });

    it('일반 사용자(관리자 권한 없음)의 경우 403 Forbidden을 반환한다', async () => {
      currentUser = {
        uuid: 'user-uuid-1',
        nickName: 'NormalUser',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer()).get('/ai/prompts/rag-qa-system/active');

      expect(res.status).toBe(403);
      expect(mockAiServicePy.get).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /ai/prompts/:name/active (활성 버전 비활성화)', () => {
    it('관리자 권한이 있는 경우 userId 쿼리가 없으면 params 없이 활성 버전 비활성화를 요청한다', async () => {
      currentUser = {
        id: 1,
        name: 'Admin User',
        email: 'admin@test.com',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer()).delete('/ai/prompts/rag-qa-system/active');

      expect(res.status).toBe(204);
      expect(mockAiServicePy.delete).toHaveBeenCalledWith({
        method: 'prompts/rag-qa-system/active',
      });
    });

    it('관리자 권한이 있는 경우 userId 쿼리가 지정되면 params에 userId를 포함하여 전달한다', async () => {
      currentUser = {
        id: 1,
        name: 'Admin User',
        email: 'admin@test.com',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer()).delete('/ai/prompts/rag-qa-system/active?userId=target-user');

      expect(res.status).toBe(204);
      expect(mockAiServicePy.delete).toHaveBeenCalledWith({
        method: 'prompts/rag-qa-system/active',
        params: { userId: 'target-user' },
      });
    });

    it('일반 사용자(관리자 권한 없음)의 경우 403 Forbidden을 반환한다', async () => {
      currentUser = {
        uuid: 'user-uuid-1',
        nickName: 'NormalUser',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer()).delete('/ai/prompts/rag-qa-system/active');

      expect(res.status).toBe(403);
      expect(mockAiServicePy.delete).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /ai/prompts/:name/:version (특정 버전 삭제)', () => {
    it('관리자 권한이 있는 경우 userId 쿼리가 없으면 params 없이 특정 버전 삭제를 요청한다', async () => {
      currentUser = {
        id: 1,
        name: 'Admin User',
        email: 'admin@test.com',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer()).delete('/ai/prompts/rag-qa-system/1');

      expect(res.status).toBe(204);
      expect(mockAiServicePy.delete).toHaveBeenCalledWith({
        method: 'prompts/rag-qa-system/1',
      });
    });

    it('관리자 권한이 있는 경우 userId 쿼리가 지정되면 params에 userId를 포함하여 전달한다', async () => {
      currentUser = {
        id: 1,
        name: 'Admin User',
        email: 'admin@test.com',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer()).delete('/ai/prompts/rag-qa-system/1?userId=target-user');

      expect(res.status).toBe(204);
      expect(mockAiServicePy.delete).toHaveBeenCalledWith({
        method: 'prompts/rag-qa-system/1',
        params: { userId: 'target-user' },
      });
    });

    it('일반 사용자(관리자 권한 없음)의 경우 403 Forbidden을 반환한다', async () => {
      currentUser = {
        uuid: 'user-uuid-1',
        nickName: 'NormalUser',
        activatedAt: new Date(),
      };

      const res = await request(app.getHttpServer()).delete('/ai/prompts/rag-qa-system/1');

      expect(res.status).toBe(403);
      expect(mockAiServicePy.delete).not.toHaveBeenCalled();
    });
  });
});
