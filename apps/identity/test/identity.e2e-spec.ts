process.env.PERSONAL_DB_HOST = 'localhost';
process.env.PERSONAL_DB_PORT = '3306';
process.env.PERSONAL_DB_USER_NAME = 'admin';
process.env.PERSONAL_DB_USER_PW = process.env.DB_USER_PW || 'test-password';
process.env.PERSONAL_DB_NAME = 'personal';
process.env.PERSONAL_DB_SYNCHRONIZE = 'true';

process.env.GAME_DB_HOST = 'localhost';
process.env.GAME_DB_PORT = '3306';
process.env.GAME_DB_USER_NAME = 'admin';
process.env.GAME_DB_USER_PW = process.env.DB_USER_PW || 'test-password';
process.env.GAME_DB_NAME = 'game';
process.env.GAME_DB_SYNCHRONIZE = 'true';

process.env.REDIS_DB_HOST = 'localhost';
process.env.REDIS_DB_PORT = '6379';
process.env.CHAT_REDIS_HOST = 'localhost';
process.env.CHAT_REDIS_PORT = '6379';
process.env.CHAT_REDIS_DB_NUMBER = '2';

process.env.MONGODB_ATLAS_URI =
  process.env.MONGODB_ATLAS_URI || 'mongodb://localhost:27017';
process.env.ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret';
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'test-groq-key';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { IdentityModule } from '../src/identity.module';
import { JwtAuthGuard } from '@libs/auth';
import { IUsersRepository } from '../../../libs/auth/src/user/domain/repository/users.repository';
import { createUsersRepositoryMock } from '../../../test-support/mocks/users-repository.mock';
import { createUserFixture } from '../../../test-support/fixtures/user.fixture';

describe('Identity E2E', () => {
  let app: INestApplication;
  const usersRepoMock = createUsersRepositoryMock();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [IdentityModule],
    })
      .overrideProvider(IUsersRepository)
      .useValue(usersRepoMock)
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/signup', () => {
    it('정상 가입 시 code 0 반환', async () => {
      const userFixture = createUserFixture();
      usersRepoMock.countByEmail.mockResolvedValue(0);
      usersRepoMock.persist.mockResolvedValue(userFixture);

      const res = await request(app.getHttpServer()).post('/auth/signup').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test@12345!',
      });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data.email).toBe(userFixture.email.getValue());
    });

    it('이름이 공백이면 에러 코드 반환', async () => {
      const res = await request(app.getHttpServer()).post('/auth/signup').send({
        name: '   ',
        email: 'test@example.com',
        password: 'Test@12345!',
      });

      expect(res.body.code).not.toBe(0);
    });
  });

  describe('POST /auth/login', () => {
    it('정상 로그인 시 token 포함 응답', async () => {
      const userFixture = createUserFixture();
      usersRepoMock.findByEmail.mockResolvedValue(userFixture);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'Test@12345!' });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('authToken');
    });
  });
});
