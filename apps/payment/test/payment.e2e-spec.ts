// docker-compose.yml의 db 컨테이너는 ${DB_USER}/${DB_USER_PW}(.env)로 유저를 생성한다.
// 로컬에 이미 그 값이 export돼 있으면 그대로 쓰고, 없으면 기존 하드코딩 값으로 폴백한다.
process.env.PERSONAL_DB_HOST = 'localhost';
process.env.PERSONAL_DB_PORT = '3306';
process.env.PERSONAL_DB_USER_NAME = process.env.DB_USER || 'admin';
process.env.PERSONAL_DB_USER_PW = process.env.DB_USER_PW || 'personal!23';
process.env.PERSONAL_DB_NAME = 'personal';
process.env.PERSONAL_DB_SYNCHRONIZE = 'true';

process.env.GAME_DB_HOST = 'localhost';
process.env.GAME_DB_PORT = '3306';
process.env.GAME_DB_USER_NAME = process.env.DB_USER || 'admin';
process.env.GAME_DB_USER_PW = process.env.DB_USER_PW || 'personal!23';
process.env.GAME_DB_NAME = 'game';
process.env.GAME_DB_SYNCHRONIZE = 'true';

process.env.PAYMENT_DB_HOST = 'localhost';
process.env.PAYMENT_DB_PORT = '3306';
process.env.PAYMENT_DB_USER_NAME = process.env.DB_USER || 'admin';
process.env.PAYMENT_DB_USER_PW = process.env.DB_USER_PW || 'personal!23';
process.env.PAYMENT_DB_NAME = 'payment';
process.env.PAYMENT_DB_SYNCHRONIZE = 'true';

process.env.REDIS_DB_HOST = 'localhost';
process.env.REDIS_DB_PORT = '6379';
process.env.CHAT_REDIS_HOST = 'localhost';
process.env.CHAT_REDIS_PORT = '6379';
process.env.CHAT_REDIS_DB_NUMBER = '2';

process.env.ACCESS_TOKEN_SECRET = 'personal project';
process.env.REFRESH_TOKEN_SECRET = 'personal project refresh';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PaymentModule } from '../src/payment.module';

describe('Payment E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PaymentModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    // Kafka producer/Redis 클라이언트/outbox 릴레이까지 정리되는 데 기본 5s hook 타임아웃보다 오래 걸릴 수 있다.
  }, 15000);

  describe('GET /health', () => {
    it('헬스체크 성공 시 environment 포함 응답', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('environment');
    });
  });
});
