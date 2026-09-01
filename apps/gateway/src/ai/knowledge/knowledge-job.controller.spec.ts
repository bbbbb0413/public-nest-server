import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { KnowledgeJobController } from './knowledge-job.controller';
import { JobStoreService } from '../job/job-store.service';
import { KnowledgeFileStagingService } from './knowledge-file-staging.service';
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

describe('KnowledgeJobController', () => {
  let app: INestApplication;
  let mockJobStore: any;
  let mockFileStaging: any;
  let mockProducer: any;

  beforeEach(async () => {
    mockJobStore = {
      createJob: jest.fn().mockResolvedValue({ job: { jobId: 'job-123' }, isNew: true }),
    };
    mockFileStaging = {
      stage: jest.fn().mockResolvedValue(undefined),
    };
    mockProducer = {
      publishKnowledgeIngestRequested: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [KnowledgeJobController],
      providers: [
        { provide: JobStoreService, useValue: mockJobStore },
        { provide: KnowledgeFileStagingService, useValue: mockFileStaging },
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

  describe('POST /ai/knowledge/jobs (Upload Validation)', () => {
    it('성공 시: 올바른 형식(.txt) 및 10MB 이하 파일 업로드 시 202 응답', async () => {
      const buffer = Buffer.from('test file content');
      const res = await request(app.getHttpServer())
        .post('/ai/knowledge/jobs')
        .attach('file', buffer, 'test.txt');

      expect(res.status).toBe(202);
      expect(res.body).toEqual({ jobId: 'job-123' });
      expect(mockJobStore.createJob).toHaveBeenCalledWith('user-uuid-123', 'knowledge.ingest');
      expect(mockFileStaging.stage).toHaveBeenCalledWith('job-123', expect.any(Buffer));
      expect(mockProducer.publishKnowledgeIngestRequested).toHaveBeenCalledWith({
        jobId: 'job-123',
        fileName: 'test.txt',
        mimeType: 'text/plain',
      });
    });

    it('에러 시: 파일 미포함(누락) 시 400 Bad Request 및 에러 메시지 반환', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/knowledge/jobs');

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('업로드할 파일이 누락되었습니다.');
    });

    it('에러 시: 지원하지 않는 형식(.png) 업로드 시 400 Bad Request 및 에러 메시지 반환', async () => {
      const buffer = Buffer.from('fake image content');
      const res = await request(app.getHttpServer())
        .post('/ai/knowledge/jobs')
        .attach('file', buffer, 'avatar.png');

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('지원하지 않는 파일 형식입니다. (TXT, PDF, MD 파일만 지원)');
    });

    it('에러 시: 50MB 초과 파일 업로드 시 413 Payload Too Large 또는 400 Bad Request 및 에러 메시지 반환', async () => {
      // 50MB 초과하는 파일 버퍼 생성 (50MB = 50 * 1024 * 1024 bytes)
      const largeBuffer = Buffer.alloc(50 * 1024 * 1024 + 100);
      const res = await request(app.getHttpServer())
        .post('/ai/knowledge/jobs')
        .attach('file', largeBuffer, 'large.txt');

      // 400 또는 413을 모두 허용하도록 스펙에 나와 있음
      expect([400, 413]).toContain(res.status);
      expect(res.body.message).toBe('파일 크기가 50MB 제한을 초과했습니다.');
    });
  });
});
