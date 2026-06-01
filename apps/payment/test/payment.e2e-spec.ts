process.env.PERSONAL_DB_HOST = 'localhost';
process.env.PERSONAL_DB_PORT = '3306';
process.env.PERSONAL_DB_USER_NAME = 'admin';
process.env.PERSONAL_DB_USER_PW = 'personal!23';
process.env.PERSONAL_DB_NAME = 'personal';
process.env.PERSONAL_DB_SYNCHRONIZE = 'true';

process.env.GAME_DB_HOST = 'localhost';
process.env.GAME_DB_PORT = '3306';
process.env.GAME_DB_USER_NAME = 'admin';
process.env.GAME_DB_USER_PW = 'personal!23';
process.env.GAME_DB_NAME = 'game';
process.env.GAME_DB_SYNCHRONIZE = 'true';

process.env.PAYMENT_DB_HOST = 'localhost';
process.env.PAYMENT_DB_PORT = '3306';
process.env.PAYMENT_DB_USER_NAME = 'admin';
process.env.PAYMENT_DB_USER_PW = 'personal!23';
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
  });

  describe('GET /health', () => {
    it('헬스체크 성공 시 environment 포함 응답', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('environment');
    });
  });
});
