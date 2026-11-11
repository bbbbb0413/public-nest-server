import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AdminGatewayController } from './admin-gateway.controller';
import {
  ChangeAdminPasswordInDto,
  UpdateRoleUserInDto,
} from './dto/admin-request.dto';

describe('AdminGatewayController', () => {
  let controller: AdminGatewayController;
  let mockAdminServiceClient: any;

  beforeEach(async () => {
    mockAdminServiceClient = {
      changeAdminPassword: jest.fn(),
      updateAdminUserRole: jest.fn(),
      getAdminUsers: jest.fn(),
      getAdminUser: jest.fn(),
      activateAdminUser: jest.fn(),
      removeAdminUser: jest.fn(),
      signup: jest.fn(),
      adminLogin: jest.fn(),
    };

    const mockClientGrpc = {
      getService: jest.fn().mockReturnValue(mockAdminServiceClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminGatewayController],
      providers: [
        {
          provide: 'ADMIN_SERVICE',
          useValue: mockClientGrpc,
        },
      ],
    }).compile();

    controller = module.get<AdminGatewayController>(AdminGatewayController);
    controller.onModuleInit();
  });

  describe('DTO 검증', () => {
    describe('ChangeAdminPasswordInDto', () => {
      it('email과 password가 올바르게 주어지면(name 없이도) 유효성 검증을 통과해야 한다', async () => {
        const plain = {
          email: 'admin@example.com',
          password: 'Password123!',
        };
        const dto = plainToInstance(ChangeAdminPasswordInDto, plain);
        const errors = await validate(dto as object);
        expect(errors.length).toBe(0);
      });

      it('email이 유효하지 않은 형식이면 유효성 검증에 실패해야 한다', async () => {
        const plain = {
          email: 'not-an-email',
          password: 'Password123!',
        };
        const dto = plainToInstance(ChangeAdminPasswordInDto, plain);
        const errors = await validate(dto as object);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some((e) => e.property === 'email')).toBe(true);
      });

      it('password가 누락되면 유효성 검증에 실패해야 한다', async () => {
        const plain = {
          email: 'admin@example.com',
        };
        const dto = plainToInstance(ChangeAdminPasswordInDto, plain);
        const errors = await validate(dto as object);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some((e) => e.property === 'password')).toBe(true);
      });
    });

    describe('UpdateRoleUserInDto', () => {
      it('userId만 주어지고 role이 없어도 유효성 검증을 통과해야 한다', async () => {
        const plain = {
          userId: 1,
        };
        const dto = plainToInstance(UpdateRoleUserInDto, plain);
        const errors = await validate(dto as object);
        expect(errors.length).toBe(0);
      });

      it('userId와 유효한 role 문자열이 주어지면 유효성 검증을 통과해야 한다', async () => {
        const plain = {
          userId: 1,
          role: 'admin',
        };
        const dto = plainToInstance(UpdateRoleUserInDto, plain);
        const errors = await validate(dto as object);
        expect(errors.length).toBe(0);
      });

      it('role이 문자열이 아닌 경우 유효성 검증에 실패해야 한다', async () => {
        const plain = {
          userId: 1,
          role: 12345,
        };
        const dto = plainToInstance(UpdateRoleUserInDto, plain);
        const errors = await validate(dto as object);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some((e) => e.property === 'role')).toBe(true);
      });
    });
  });

  describe('changePassword', () => {
    it('요청 DTO로부터 name 필드에 email을 채워 gRPC changeAdminPassword를 호출해야 한다', async () => {
      const dto: ChangeAdminPasswordInDto = {
        email: 'user@example.com',
        password: 'NewPassword123!',
      };
      const req = {
        user: { email: 'admin@example.com' },
      };

      mockAdminServiceClient.changeAdminPassword.mockReturnValue(of({}));

      const res = await controller.changePassword(dto, req);

      expect(mockAdminServiceClient.changeAdminPassword).toHaveBeenCalledWith({
        name: 'user@example.com',
        email: 'user@example.com',
        password: 'NewPassword123!',
        executorEmail: 'admin@example.com',
      });
      expect((res as any).code).toBe(0);
    });
  });

  describe('updateRole', () => {
    it('userId를 포함하여 gRPC updateAdminUserRole을 호출해야 한다', async () => {
      const dto: UpdateRoleUserInDto = {
        userId: 1,
        role: 'admin',
      };
      const timestamp = 1767225600000;
      const reply = {
        id: 1,
        name: '관리자',
        email: 'admin@example.com',
        activatedAt: timestamp,
      };

      mockAdminServiceClient.updateAdminUserRole.mockReturnValue(of(reply));

      const res = await controller.updateRole(dto);

      expect(mockAdminServiceClient.updateAdminUserRole).toHaveBeenCalledWith({
        userId: 1,
      });
      expect((res as any).code).toBe(0);
      expect((res as any).data).toEqual({
        id: 1,
        name: '관리자',
        email: 'admin@example.com',
        activatedAt: new Date(timestamp),
      });
    });
  });
});
