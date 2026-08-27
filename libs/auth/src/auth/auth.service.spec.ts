import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ISessionRepository } from './port/session-repository.port';
import { UnauthorizedException } from '@nestjs/common';

const createSessionRepositoryMock = () => ({
  getSession: jest.fn(),
  setSession: jest.fn(),
});

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: any;
  let sessionRepository: ReturnType<typeof createSessionRepositoryMock>;

  beforeEach(async () => {
    sessionRepository = createSessionRepositoryMock();
    jwtService = { sign: jest.fn().mockReturnValue('mock-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwtService },
        { provide: ISessionRepository, useValue: sessionRepository },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('validateApiKey', () => {
    it('환경변수에 등록된 API 키를 반환한다', () => {
      process.env.AUTH_KEY = 'valid-key';
      const testService = new AuthService(jwtService, sessionRepository as any);
      const result = testService.validateApiKey('valid-key');
      expect(result).toBe('valid-key');
    });

    it('미등록 API 키는 undefined를 반환한다', () => {
      const result = service.validateApiKey('invalid-key');
      expect(result).toBeUndefined();
    });
  });

  describe('validateUser', () => {
    it('activatedAt이 있으면 true를 반환한다', () => {
      const result = service.validateUser({
        activatedAt: new Date(),
        email: 't@e.com',
        id: 1,
        name: 'n',
      });
      expect(result).toBe(true);
    });

    it('activatedAt이 없으면 false를 반환한다', () => {
      const result = service.validateUser({
        email: 't@e.com',
        id: 1,
        name: 'n',
        activatedAt: null,
      });
      expect(result).toBe(false);
    });
  });

  describe('makeAuthToken', () => {
    it('JWT 토큰을 생성한다', () => {
      const result = service.makeAuthToken({ id: 1 });
      expect(result).toBe('mock-token');
      expect(jwtService.sign).toHaveBeenCalledWith({ id: 1 });
    });
  });

  describe('validateSession', () => {
    it('세션이 없으면 UnauthorizedException을 던진다', async () => {
      sessionRepository.getSession.mockResolvedValue(null);
      await expect(service.validateSession('1', 'session-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('세션 ID 불일치 시 UnauthorizedException을 던진다', async () => {
      sessionRepository.getSession.mockResolvedValue({ id: 'other-id' } as any);
      await expect(service.validateSession('1', 'session-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('유효한 세션 반환', async () => {
      const mockSession = { id: 'session-id' };
      sessionRepository.getSession.mockResolvedValue(mockSession as any);
      const result = await service.validateSession('1', 'session-id');
      expect(result).toBe(mockSession);
    });
  });
});
