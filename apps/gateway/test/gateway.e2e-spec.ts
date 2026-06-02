process.env.REDIS_DB_HOST = 'localhost';
process.env.REDIS_DB_PORT = '6379';
process.env.ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret';
process.env.IDENTITY_GRPC_URL = 'localhost:50051';
process.env.PAYMENT_GRPC_URL = 'localhost:50052';
process.env.CHAT_GRPC_URL = 'localhost:50053';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { of, Observable } from 'rxjs';
import { GatewayAuthGuard } from '../src/auth/gateway-auth.guard';
import { GrpcExceptionFilter } from '../src/filter/grpc-exception.filter';
import { IdentityGatewayController } from '../src/identity/identity-gateway.controller';
import { PaymentGatewayController } from '../src/payment/payment-gateway.controller';
import { Session } from '@libs/shared-kernel';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';

const mockSession = Session.create({
  id: 'session-1',
  uuid: 'uuid-abc',
  nickName: 'Tester',
  gameDbId: 42,
  database: 'game_db',
});

const mockIdentityService = {
  login: jest.fn(),
  getGameAccount: jest.fn(),
  sendMail: jest.fn(),
};

const mockPaymentService = {
  createPayment: jest.fn(),
  getPayment: jest.fn(),
};

const mockIdentityClientGrpc = {
  getService: jest.fn().mockReturnValue(mockIdentityService),
};

const mockPaymentClientGrpc = {
  getService: jest.fn().mockReturnValue(mockPaymentService),
};

function rpcError(code: number, message: string): Observable<never> {
  return new Observable((subscriber) => {
    subscriber.error(new RpcException({ code, message }));
  });
}

describe('Gateway E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [IdentityGatewayController, PaymentGatewayController],
      providers: [
        {
          provide: 'IDENTITY_SERVICE',
          useValue: mockIdentityClientGrpc,
        },
        {
          provide: 'PAYMENT_SERVICE',
          useValue: mockPaymentClientGrpc,
        },
      ],
    })
      .overrideGuard(GatewayAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().session = mockSession;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new GrpcExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Identity ──────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('uuid 전달 시 gRPC login 호출 후 성공 응답', async () => {
      const loginReply = { id: 1, uuid: 'uuid-abc', nickName: 'Tester' };
      mockIdentityService.login.mockReturnValue(of(loginReply));

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ uuid: 'uuid-abc' });

      expect(res.status).toBeLessThan(300);
      expect(res.body.code).toBe(0);
      expect(res.body.data.uuid).toBe('uuid-abc');
      expect(mockIdentityService.login).toHaveBeenCalledWith(
        expect.objectContaining({ uuid: 'uuid-abc' }),
      );
    });

    it('uuid 누락 시 400 반환', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /accounts/:uuid', () => {
    it('gRPC getGameAccount 호출 후 성공 응답', async () => {
      const accountReply = { id: 42, uuid: 'uuid-abc', nickName: 'Tester' };
      mockIdentityService.getGameAccount.mockReturnValue(of(accountReply));

      const res = await request(app.getHttpServer()).get('/accounts/uuid-abc');

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data.uuid).toBe('uuid-abc');
    });

    it('gRPC NOT_FOUND → 404 반환', async () => {
      mockIdentityService.getGameAccount.mockReturnValue(
        rpcError(status.NOT_FOUND, 'not found'),
      );

      const res = await request(app.getHttpServer()).get('/accounts/unknown');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /mails', () => {
    it('메일 발송 gRPC 호출 후 성공 응답', async () => {
      const mailReply = { mailId: 100, delivered: true };
      mockIdentityService.sendMail.mockReturnValue(of(mailReply));

      const res = await request(app.getHttpServer())
        .post('/mails')
        .send({ accountId: 42, title: 'Hello', body: 'World' });

      expect(res.status).toBeLessThan(300);
      expect(res.body.code).toBe(0);
      expect(res.body.data.delivered).toBe(true);
    });
  });

  // ─── Payment ───────────────────────────────────────────────

  describe('POST /payments', () => {
    it('결제 생성 gRPC 호출 후 성공 응답', async () => {
      const paymentReply = {
        id: 1,
        amount: 1000,
        currency: 'KRW',
        status: 'SUCCESS',
      };
      mockPaymentService.createPayment.mockReturnValue(of(paymentReply));

      const res = await request(app.getHttpServer())
        .post('/payments')
        .send({ amount: 1000, currency: 'KRW', productId: 'item-1' });

      expect(res.status).toBeLessThan(300);
      expect(res.body.code).toBe(0);
      expect(res.body.data.amount).toBe(1000);
    });

    it('gRPC INVALID_ARGUMENT → 400 반환', async () => {
      mockPaymentService.createPayment.mockReturnValue(
        rpcError(status.INVALID_ARGUMENT, 'invalid amount'),
      );

      const res = await request(app.getHttpServer())
        .post('/payments')
        .send({ amount: -1, currency: 'KRW', productId: 'item-1' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /payments/:id', () => {
    it('결제 조회 gRPC 호출 후 성공 응답', async () => {
      const paymentReply = {
        id: 1,
        amount: 1000,
        currency: 'KRW',
        status: 'SUCCESS',
      };
      mockPaymentService.getPayment.mockReturnValue(of(paymentReply));

      const res = await request(app.getHttpServer()).get('/payments/1');

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data.id).toBe(1);
    });

    it('숫자가 아닌 id → 400 반환', async () => {
      const res = await request(app.getHttpServer()).get('/payments/abc');
      expect(res.status).toBe(400);
    });
  });

  // ─── gRPC → HTTP 에러 코드 매핑 ──────────────────────────

  describe('gRPC 에러 코드 매핑', () => {
    it('UNAVAILABLE → 503', async () => {
      mockPaymentService.getPayment.mockReturnValue(
        rpcError(status.UNAVAILABLE, 'service down'),
      );

      const res = await request(app.getHttpServer()).get('/payments/1');
      expect(res.status).toBe(503);
    });

    it('FAILED_PRECONDITION → 422', async () => {
      mockPaymentService.getPayment.mockReturnValue(
        rpcError(status.FAILED_PRECONDITION, 'precondition failed'),
      );

      const res = await request(app.getHttpServer()).get('/payments/1');
      expect(res.status).toBe(422);
    });

    it('PERMISSION_DENIED → 403', async () => {
      mockPaymentService.getPayment.mockReturnValue(
        rpcError(status.PERMISSION_DENIED, 'forbidden'),
      );

      const res = await request(app.getHttpServer()).get('/payments/1');
      expect(res.status).toBe(403);
    });
  });
});
