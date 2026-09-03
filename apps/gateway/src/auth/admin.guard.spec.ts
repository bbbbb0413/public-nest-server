import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  const createMockContext = (user: any): ExecutionContext => {
    const request = { user };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  it('관리자 계정(email 및 activatedAt 보유)인 경우 canActivate가 true를 반환해야 한다', () => {
    const context = createMockContext({
      id: 1,
      name: 'Admin User',
      email: 'admin@test.com',
      activatedAt: new Date(),
    });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('일반 사용자(email 부재)인 경우 ForbiddenException을 던져야 한다', () => {
    const context = createMockContext({
      uuid: 'user-uuid-123',
      nickName: 'GameUser',
      activatedAt: new Date(),
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('사용자 정보가 없는 경우 ForbiddenException을 던져야 한다', () => {
    const context = createMockContext(null);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('활성화되지 않은 관리자(activatedAt 부재)인 경우 ForbiddenException을 던져야 한다', () => {
    const context = createMockContext({
      id: 1,
      name: 'Pending Admin',
      email: 'pending@test.com',
      activatedAt: null,
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
