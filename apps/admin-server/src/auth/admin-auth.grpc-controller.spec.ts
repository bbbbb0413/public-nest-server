import { Test, TestingModule } from '@nestjs/testing';
import { AdminAuthGrpcController } from './admin-auth.grpc-controller';
import { UserService } from '../user/user.service';
import { AuthService } from '@libs/auth';
import { ServerErrorException } from '@libs/common/exception/server-error.exception';
import { INTERNAL_ERROR_CODE } from '@libs/common/constants/internal-error-code.constants';

describe('AdminAuthGrpcController', () => {
  let controller: AdminAuthGrpcController;
  let mockUserService: any;
  let mockAuthService: any;

  beforeEach(async () => {
    mockUserService = {
      changePassword: jest.fn(),
      updateRole: jest.fn(),
      signup: jest.fn(),
      signIn: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      activate: jest.fn(),
      deactivate: jest.fn(),
      removeAdminUser: jest.fn(),
    };

    mockAuthService = {
      makeAuthToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuthGrpcController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AdminAuthGrpcController>(AdminAuthGrpcController);
  });

  describe('changeAdminPassword', () => {
    it('요청 파라미터를 userService.changePassword로 올바르게 위임하고 빈 객체를 반환해야 한다', async () => {
      const request = {
        name: 'user@example.com',
        email: 'user@example.com',
        password: 'NewPassword123!',
        executorEmail: 'admin@example.com',
      };

      mockUserService.changePassword.mockResolvedValue(undefined);

      const result = await controller.changeAdminPassword(request);

      expect(mockUserService.changePassword).toHaveBeenCalledWith(
        {
          name: request.name,
          email: request.email,
          password: request.password,
        },
        request.executorEmail,
      );
      expect(result).toEqual({});
    });

    it('userService.changePassword에서 예외가 발생하면 그대로 전파해야 한다', async () => {
      const request = {
        name: 'user@example.com',
        email: 'user@example.com',
        password: 'weak',
        executorEmail: 'admin@example.com',
      };
      const error = new ServerErrorException(
        INTERNAL_ERROR_CODE.ERROR,
        '비밀번호는 10~30자이며 소문자/대문자/숫자/특수문자 중 4가지를 포함해야 합니다.',
      );

      mockUserService.changePassword.mockRejectedValue(error);

      await expect(controller.changeAdminPassword(request)).rejects.toThrow(
        error,
      );
    });
  });

  describe('updateAdminUserRole', () => {
    it('userService.updateRole을 호출할 때 미지원 기능 예외가 발생하면 그대로 전파해야 한다', async () => {
      const request = {
        userId: 1,
      };
      const error = new ServerErrorException(
        INTERNAL_ERROR_CODE.ERROR,
        '현재 사용자 권한 변경 기능은 지원되지 않습니다.',
      );

      mockUserService.updateRole.mockImplementation(() => {
        throw error;
      });

      await expect(async () =>
        controller.updateAdminUserRole(request),
      ).rejects.toThrow(error);
      expect(mockUserService.updateRole).toHaveBeenCalledWith({ userId: 1 });
    });
  });
});
