import { GatewayAuthGuard } from './gateway-auth.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

jest.mock('@nestjs/passport', () => {
  return {
    AuthGuard: jest.fn((type) => {
      return class MockGuard {
        canActivate = jest.fn().mockImplementation(async (context) => {
          const req = context.switchToHttp().getRequest();
          if (type === 'jwt') {
            req.user = { id: 1, name: 'JWT User', email: 'jwt@test.com', activatedAt: new Date() };
          } else if (type === 'basic') {
            req.user = { id: 'session-id-123', uuid: 'user-uuid-123', nickName: 'Basic User', gameDbId: 777, database: 'db1' };
          } else if (type === 'apiKey') {
            req.user = true;
          }
          return true;
        });
      };
    }),
  };
});

describe('GatewayAuthGuard', () => {
  let guard: GatewayAuthGuard;
  let mockReflector: any;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    };
    guard = new GatewayAuthGuard(mockReflector);
  });

  const createMockContext = (headers: Record<string, string>): ExecutionContext => {
    const request = { headers, user: null, session: null };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  it('Public 메타데이터가 true면 canActivate가 항상 true를 반환해야 한다', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(true);
    const context = createMockContext({});
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('Bearer 토큰 헤더가 있으면 JWT Guard를 기동하고 Session을 탑재해야 한다', async () => {
    const context = createMockContext({ authorization: 'Bearer token123' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    const req = context.switchToHttp().getRequest();
    expect(req.session).toBeDefined();
    expect(req.session.nickName).toBe('JWT User');
    expect(req.session.uuid).toBe('1');
  });

  it('Basic 인증 헤더가 있으면 Basic Guard를 기동하고 Session을 탑재해야 한다', async () => {
    const context = createMockContext({ authorization: 'Basic credentials123' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    const req = context.switchToHttp().getRequest();
    expect(req.session).toBeDefined();
    expect(req.session.nickName).toBe('Basic User');
    expect(req.session.uuid).toBe('user-uuid-123');
  });

  it('X-API-KEY 헤더가 있으면 ApiKey Guard를 기동하고 Session을 탑재해야 한다', async () => {
    const context = createMockContext({ 'x-api-key': 'key123' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    const req = context.switchToHttp().getRequest();
    expect(req.session).toBeDefined();
    expect(req.session.uuid).toBe('api-key-user');
  });

  it('인증 헤더가 모두 누락되었을 경우 UnauthorizedException을 발생시켜야 한다', async () => {
    const context = createMockContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
