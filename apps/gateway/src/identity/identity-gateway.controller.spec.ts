import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { IdentityGatewayController } from './identity-gateway.controller';
import { AuthService } from '@libs/auth';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

describe('IdentityGatewayController', () => {
  let controller: IdentityGatewayController;
  let mockIdentityServiceClient: any;
  let mockAuthService: any;

  beforeEach(async () => {
    mockIdentityServiceClient = {
      login: jest.fn(),
      register: jest.fn(),
      getGameAccount: jest.fn(),
      sendMail: jest.fn(),
    };

    mockAuthService = {
      makeAuthToken: jest.fn().mockReturnValue('mocked-jwt-token'),
    };

    const mockClientGrpc = {
      getService: jest.fn().mockReturnValue(mockIdentityServiceClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IdentityGatewayController],
      providers: [
        {
          provide: 'IDENTITY_SERVICE',
          useValue: mockClientGrpc,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<IdentityGatewayController>(IdentityGatewayController);
    controller.onModuleInit();
  });

  describe('login', () => {
    it('로그인 성공 시 accountId가 포함된 TokenResponse를 ResponseEntity로 반환해야 한다', async () => {
      const dto: LoginDto = { uuid: 'test-uuid-123' };
      const reply = {
        id: 12345,
        uuid: 'test-uuid-123',
        nickName: 'test-nickname',
      };

      mockIdentityServiceClient.login.mockReturnValue(of(reply));

      const response = await controller.login(dto);

      expect(mockIdentityServiceClient.login).toHaveBeenCalledWith({
        uuid: dto.uuid,
      });
      expect(mockAuthService.makeAuthToken).toHaveBeenCalledWith({
        uuid: reply.uuid,
        nickName: reply.nickName,
        activatedAt: expect.any(Date),
      });

      expect((response as any).data).toEqual({
        token: 'mocked-jwt-token',
        uuid: 'test-uuid-123',
        nickName: 'test-nickname',
        accountId: 12345,
      });
    });
  });

  describe('register', () => {
    it('회원가입 성공 시 accountId가 포함된 TokenResponse를 ResponseEntity로 반환해야 한다', async () => {
      const dto: RegisterDto = { nickName: 'new-user' };
      const reply = {
        id: 67890,
        uuid: 'new-uuid-456',
        nickName: 'new-user',
      };

      mockIdentityServiceClient.register.mockReturnValue(of(reply));

      const response = await controller.register(dto);

      expect(mockIdentityServiceClient.register).toHaveBeenCalledWith({
        nickName: dto.nickName,
      });
      expect(mockAuthService.makeAuthToken).toHaveBeenCalledWith({
        uuid: reply.uuid,
        nickName: reply.nickName,
        activatedAt: expect.any(Date),
      });

      expect((response as any).data).toEqual({
        token: 'mocked-jwt-token',
        uuid: 'new-uuid-456',
        nickName: 'new-user',
        accountId: 67890,
      });
    });
  });
});
