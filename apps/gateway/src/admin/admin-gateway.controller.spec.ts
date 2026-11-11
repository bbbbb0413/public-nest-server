import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { Order } from '@libs/common/pagination/dto/page-options.dto';
import { AdminGatewayController } from './admin-gateway.controller';
import {
  ChangeAdminPasswordInDto,
  UpdateActivateUserInDto,
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

  describe('DTO 검증 (ValidationPipe)', () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    describe('ChangeAdminPasswordInDto', () => {
      it('email과 password가 올바르게 주어지면(name 없이도) 유효성 검증을 통과해야 한다', async () => {
        const plain = {
          email: 'admin@example.com',
          password: 'Password123!',
        };
        const transformed = await pipe.transform(plain, {
          type: 'body',
          metatype: ChangeAdminPasswordInDto,
        });
        expect(transformed).toBeInstanceOf(ChangeAdminPasswordInDto);
        expect(transformed.email).toBe('admin@example.com');
        expect(transformed.password).toBe('Password123!');
      });

      it('email이 유효하지 않은 형식이면 유효성 검증에 실패(400)해야 한다', async () => {
        const plain = {
          email: 'not-an-email',
          password: 'Password123!',
        };
        await expect(
          pipe.transform(plain, {
            type: 'body',
            metatype: ChangeAdminPasswordInDto,
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('password가 누락되면 유효성 검증에 실패(400)해야 한다', async () => {
        const plain = {
          email: 'admin@example.com',
        };
        await expect(
          pipe.transform(plain, {
            type: 'body',
            metatype: ChangeAdminPasswordInDto,
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('email이 누락되면 유효성 검증에 실패(400)해야 한다', async () => {
        const plain = {
          password: 'Password123!',
        };
        await expect(
          pipe.transform(plain, {
            type: 'body',
            metatype: ChangeAdminPasswordInDto,
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('whitelist에 없는 프로퍼티가 포함되면 유효성 검증에 실패(400)해야 한다', async () => {
        const plain = {
          email: 'admin@example.com',
          password: 'Password123!',
          extra: 'not-allowed',
        };
        await expect(
          pipe.transform(plain, {
            type: 'body',
            metatype: ChangeAdminPasswordInDto,
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('UpdateRoleUserInDto', () => {
      it('userId만 주어지고 role이 없어도 whitelist 유효성 검증을 통과해야 한다', async () => {
        const plain = {
          userId: 1,
        };
        const transformed = await pipe.transform(plain, {
          type: 'body',
          metatype: UpdateRoleUserInDto,
        });
        expect(transformed).toBeInstanceOf(UpdateRoleUserInDto);
        expect(transformed.userId).toBe(1);
        expect(transformed.role).toBeUndefined();
      });

      it('userId와 유효한 role 문자열이 주어지면 whitelist 유효성 검증을 통과하고 필드가 유지되어야 한다', async () => {
        const plain = {
          userId: 1,
          role: 'moderator',
        };
        const transformed = await pipe.transform(plain, {
          type: 'body',
          metatype: UpdateRoleUserInDto,
        });
        expect(transformed).toBeInstanceOf(UpdateRoleUserInDto);
        expect(transformed.userId).toBe(1);
        expect(transformed.role).toBe('moderator');
      });

      it('userId가 문자열 형태 숫자여도 @Type 변환을 통해 숫자로 변환되어 통과해야 한다', async () => {
        const plain = {
          userId: '1',
          role: 'admin',
        };
        const transformed = await pipe.transform(plain, {
          type: 'body',
          metatype: UpdateRoleUserInDto,
        });
        expect(transformed.userId).toBe(1);
        expect(transformed.role).toBe('admin');
      });

      it('userId가 숫자가 아닌 경우 유효성 검증에 실패(400)해야 한다', async () => {
        const plain = {
          userId: 'invalid-id',
          role: 'admin',
        };
        await expect(
          pipe.transform(plain, {
            type: 'body',
            metatype: UpdateRoleUserInDto,
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('role이 문자열이 아닌 경우 유효성 검증에 실패(400)해야 한다', async () => {
        const plain = {
          userId: 1,
          role: 12345,
        };
        await expect(
          pipe.transform(plain, {
            type: 'body',
            metatype: UpdateRoleUserInDto,
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('whitelist에 없는 프로퍼티가 전달되면 400 에러를 던져야 한다', async () => {
        const plain = {
          userId: 1,
          role: 'admin',
          unexpected: 'value',
        };
        await expect(
          pipe.transform(plain, {
            type: 'body',
            metatype: UpdateRoleUserInDto,
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('UpdateActivateUserInDto', () => {
      it('userId와 activate가 주어지면 whitelist 유효성 검증을 통과해야 한다', async () => {
        const plain = {
          userId: 1,
          activate: true,
        };
        const transformed = await pipe.transform(plain, {
          type: 'body',
          metatype: UpdateActivateUserInDto,
        });
        expect(transformed).toBeInstanceOf(UpdateActivateUserInDto);
        expect(transformed.userId).toBe(1);
        expect(transformed.activate).toBe(true);
      });

      it('userId가 누락되면 유효성 검증에 실패(400)해야 한다', async () => {
        const plain = {
          activate: true,
        };
        await expect(
          pipe.transform(plain, {
            type: 'body',
            metatype: UpdateActivateUserInDto,
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('activate가 누락되면 유효성 검증에 실패(400)해야 한다', async () => {
        const plain = {
          userId: 1,
        };
        await expect(
          pipe.transform(plain, {
            type: 'body',
            metatype: UpdateActivateUserInDto,
          }),
        ).rejects.toThrow(BadRequestException);
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

    it('gRPC 호출 시 에러가 발생하면(복잡도 요건 미달 등) 예외를 전파해야 한다', async () => {
      const dto: ChangeAdminPasswordInDto = {
        email: 'user@example.com',
        password: 'weak',
      };
      const req = {
        user: { email: 'admin@example.com' },
      };
      const grpcError = new Error(
        '비밀번호는 10~30자이며 소문자/대문자/숫자/특수문자 중 4가지를 포함해야 합니다.',
      );

      mockAdminServiceClient.changeAdminPassword.mockReturnValue(
        throwError(() => grpcError),
      );

      await expect(controller.changePassword(dto, req)).rejects.toThrow(
        grpcError,
      );
    });

    it('req.user가 없는 경우 executorEmail은 undefined로 안전하게 전달되어야 한다', async () => {
      const dto: ChangeAdminPasswordInDto = {
        email: 'user@example.com',
        password: 'NewPassword123!',
      };
      const req = {};

      mockAdminServiceClient.changeAdminPassword.mockReturnValue(of({}));

      await controller.changePassword(dto, req);

      expect(mockAdminServiceClient.changeAdminPassword).toHaveBeenCalledWith({
        name: 'user@example.com',
        email: 'user@example.com',
        password: 'NewPassword123!',
        executorEmail: undefined,
      });
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

    it('gRPC updateAdminUserRole 호출 시 미지원 기능 에러가 발생하면 예외를 전파해야 한다', async () => {
      const dto: UpdateRoleUserInDto = {
        userId: 1,
        role: 'admin',
      };
      const grpcError = new Error(
        '현재 사용자 권한 변경 기능은 지원되지 않습니다.',
      );

      mockAdminServiceClient.updateAdminUserRole.mockReturnValue(
        throwError(() => grpcError),
      );

      await expect(controller.updateRole(dto)).rejects.toThrow(grpcError);
    });
  });

  describe('findAll', () => {
    it('어드민 유저 목록을 조회하고 페이지네이션 메타데이터와 함께 반환해야 한다', async () => {
      const pageOptions = { page: 1, take: 10, order: Order.ASC } as any;
      const timestamp = 1767225600000;
      const reply = {
        users: [
          {
            id: 1,
            name: '관리자',
            email: 'admin@example.com',
            activatedAt: timestamp,
          },
        ],
        page: 1,
        take: 10,
        itemCount: 1,
        pageCount: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      };

      mockAdminServiceClient.getAdminUsers.mockReturnValue(of(reply));

      const res = await controller.findAll(pageOptions);

      expect(mockAdminServiceClient.getAdminUsers).toHaveBeenCalledWith({
        page: 1,
        take: 10,
        order: Order.ASC,
      });
      expect((res as any).code).toBe(0);
      expect((res as any).data).toEqual([
        {
          id: 1,
          name: '관리자',
          email: 'admin@example.com',
          activatedAt: new Date(timestamp),
        },
      ]);
      expect((res as any).meta).toEqual({
        page: 1,
        take: 10,
        itemCount: 1,
        pageCount: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      });
    });
  });

  describe('findOne', () => {
    it('유저 ID로 상세 정보를 정상 조회해야 한다', async () => {
      const timestamp = 1767225600000;
      mockAdminServiceClient.getAdminUser.mockReturnValue(
        of({
          id: 2,
          name: '유저2',
          email: 'user2@example.com',
          activatedAt: timestamp,
        }),
      );

      const res = await controller.findOne(2);

      expect(mockAdminServiceClient.getAdminUser).toHaveBeenCalledWith({
        id: 2,
      });
      expect((res as any).code).toBe(0);
      expect((res as any).data).toEqual({
        id: 2,
        name: '유저2',
        email: 'user2@example.com',
        activatedAt: new Date(timestamp),
      });
    });
  });

  describe('activate', () => {
    it('유저 활성화 상태를 성공적으로 토글해야 한다', async () => {
      const timestamp = 1767225600000;
      mockAdminServiceClient.activateAdminUser.mockReturnValue(
        of({
          id: 1,
          name: '관리자',
          email: 'admin@example.com',
          activatedAt: timestamp,
        }),
      );

      const res = await controller.activate({ userId: 1, activate: true });

      expect(mockAdminServiceClient.activateAdminUser).toHaveBeenCalledWith({
        userId: 1,
        activate: true,
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
