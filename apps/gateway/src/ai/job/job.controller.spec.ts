import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JobController } from './job.controller';
import { JobStoreService } from './job-store.service';
import { AiKafkaProducerService } from '../kafka/ai-kafka-producer.service';
import { GatewayAuthGuard } from '../../auth/gateway-auth.guard';
import { Session } from '@libs/shared-kernel';

const mockSession = Session.create({
  id: 'session-123',
  uuid: 'user-uuid-123',
  nickName: 'Tester',
  gameDbId: 1,
  database: 'game_db',
});

describe('JobController', () => {
  let app: INestApplication;
  let mockJobStore: any;
  let mockProducer: any;

  beforeEach(async () => {
    mockJobStore = {
      createJob: jest.fn().mockResolvedValue({
        job: {
          jobId: 'job-123',
          userId: 'user-uuid-123',
          type: 'rag.ask',
          status: 'queued',
          createdAt: new Date().toISOString(),
        },
        isNew: true,
      }),
      getJob: jest.fn(),
      cancelJob: jest.fn().mockResolvedValue(undefined),
    };
    mockProducer = {
      publishAskRequested: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [JobController],
      providers: [
        { provide: JobStoreService, useValue: mockJobStore },
        { provide: AiKafkaProducerService, useValue: mockProducer },
      ],
    })
      .overrideGuard(GatewayAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.session = mockSession;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /ai/rag/jobs', () => {
    it('성공 시: RAG 질의응답 잡 생성 및 202 응답 반환', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/rag/jobs')
        .send({ question: '질문입니다', topK: 5, useHyde: false });

      expect(res.status).toBe(202);
      expect(res.body).toEqual({ jobId: 'job-123' });
      expect(mockJobStore.createJob).toHaveBeenCalledWith('user-uuid-123', 'rag.ask', undefined);
      expect(mockProducer.publishAskRequested).toHaveBeenCalledWith({
        jobId: 'job-123',
        userId: 'user-uuid-123',
        question: '질문입니다',
        topK: 5,
        useHyde: false,
        sessionId: undefined,
        conversationHistory: undefined,
      });
    });

    it('idempotencyKey로 이미 존재하는 잡이 반환되면(isNew=false) 재발행하지 않는다', async () => {
      mockJobStore.createJob.mockResolvedValueOnce({
        job: {
          jobId: 'existing-job-1',
          userId: 'user-uuid-123',
          type: 'rag.ask',
          status: 'processing',
          createdAt: new Date().toISOString(),
        },
        isNew: false,
      });

      const res = await request(app.getHttpServer())
        .post('/ai/rag/jobs')
        .send({ question: '질문입니다', idempotencyKey: 'idem-1' });

      expect(res.status).toBe(202);
      expect(res.body).toEqual({ jobId: 'existing-job-1' });
      expect(mockJobStore.createJob).toHaveBeenCalledWith('user-uuid-123', 'rag.ask', 'idem-1');
      expect(mockProducer.publishAskRequested).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /ai/jobs/:jobId', () => {
    it('성공 시: 자신의 잡인 경우 취소 성공 및 200 반환', async () => {
      mockJobStore.getJob.mockResolvedValue({
        jobId: 'job-123',
        userId: 'user-uuid-123',
        type: 'rag.ask',
        status: 'processing',
        createdAt: new Date().toISOString(),
      });

      const res = await request(app.getHttpServer()).delete('/ai/jobs/job-123');

      expect(res.status).toBe(200);
      expect(mockJobStore.cancelJob).toHaveBeenCalledWith('job-123');
    });

    it('성공 시: /ai/rag/jobs/:jobId 경로로도 취소 성공 및 200 반환', async () => {
      mockJobStore.getJob.mockResolvedValue({
        jobId: 'job-123',
        userId: 'user-uuid-123',
        type: 'rag.ask',
        status: 'processing',
        createdAt: new Date().toISOString(),
      });

      const res = await request(app.getHttpServer()).delete('/ai/rag/jobs/job-123');

      expect(res.status).toBe(200);
      expect(mockJobStore.cancelJob).toHaveBeenCalledWith('job-123');
    });

    it('성공 시: status가 error인 잡도 오류 없이 200 반환하며 cancelJob을 호출하지 않음', async () => {
      mockJobStore.getJob.mockResolvedValue({
        jobId: 'job-err',
        userId: 'user-uuid-123',
        type: 'rag.ask',
        status: 'error',
        createdAt: new Date().toISOString(),
      });

      const res = await request(app.getHttpServer()).delete('/ai/jobs/job-err');

      expect(res.status).toBe(200);
      expect(mockJobStore.cancelJob).not.toHaveBeenCalled();
    });

    it('성공 시: 이미 cancelled된 잡인 경우 오류 없이 200 반환하며 cancelJob을 중복 호출하지 않음', async () => {
      mockJobStore.getJob.mockResolvedValue({
        jobId: 'job-cancelled',
        userId: 'user-uuid-123',
        type: 'rag.ask',
        status: 'cancelled',
        createdAt: new Date().toISOString(),
      });

      const res = await request(app.getHttpServer()).delete('/ai/jobs/job-cancelled');

      expect(res.status).toBe(200);
      expect(mockJobStore.cancelJob).not.toHaveBeenCalled();
    });

    it('에러 시: 다른 사용자의 잡인 경우 403 Forbidden 반환', async () => {
      mockJobStore.getJob.mockResolvedValue({
        jobId: 'job-other',
        userId: 'other-user-uuid',
        type: 'rag.ask',
        status: 'processing',
        createdAt: new Date().toISOString(),
      });

      const res = await request(app.getHttpServer()).delete('/ai/jobs/job-other');

      expect(res.status).toBe(403);
      expect(mockJobStore.cancelJob).not.toHaveBeenCalled();
    });

    it('성공 시: 존재하지 않거나 이미 만료된 잡인 경우 오류 없이 200 반환', async () => {
      mockJobStore.getJob.mockResolvedValue(null);

      const res = await request(app.getHttpServer()).delete('/ai/jobs/non-existent-job');

      expect(res.status).toBe(200);
    });

    it('성공 시: 이미 완료된 잡인 경우 오류 없이 200 반환', async () => {
      mockJobStore.getJob.mockResolvedValue({
        jobId: 'job-123',
        userId: 'user-uuid-123',
        type: 'rag.ask',
        status: 'done',
        createdAt: new Date().toISOString(),
      });

      const res = await request(app.getHttpServer()).delete('/ai/jobs/job-123');

      expect(res.status).toBe(200);
    });
  });
});
