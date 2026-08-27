import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import * as jwt from 'jsonwebtoken';
import {
  AuthServiceController,
  AdminUserReply,
  AdminLoginRequest,
  AdminLoginResponse,
  SignupRequest,
  GetAdminUsersRequest,
  GetAdminUsersResponse,
  GetAdminUserRequest,
  ActivateAdminUserRequest,
  UpdateAdminUserRoleRequest,
  ChangeAdminPasswordRequest,
  RemoveAdminUserRequest,
  ValidateTokenRequest,
  ValidateTokenResponse,
  Empty,
} from '@libs/rpc';
import { AuthService } from '@libs/auth';
import { Order } from '@libs/common/pagination/dto/page-options.dto';
import { UserService } from '../user/user.service';
import { AdminGrpcMapper } from './admin-grpc.mapper';

@Controller()
export class AdminAuthGrpcController implements AuthServiceController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @GrpcMethod('AuthService', 'Signup')
  async signup(request: SignupRequest): Promise<AdminUserReply> {
    const created = await this.userService.signup(request);
    return AdminGrpcMapper.toAdminUserReply(created);
  }

  @GrpcMethod('AuthService', 'AdminLogin')
  async adminLogin(request: AdminLoginRequest): Promise<AdminLoginResponse> {
    const user = await this.userService.signIn(
      request.email,
      request.password,
    );
    const token = this.authService.makeAuthToken({
      id: user.id,
      name: user.name,
      email: user.email,
      activatedAt: user.activatedAt,
    });
    return { token, user: AdminGrpcMapper.toAdminUserReply(user) };
  }

  @GrpcMethod('AuthService', 'GetAdminUsers')
  async getAdminUsers(
    request: GetAdminUsersRequest,
  ): Promise<GetAdminUsersResponse> {
    const [users, pageMeta] = await this.userService.findAll({
      order: (request.order as Order) || Order.ASC,
      page: request.page || 1,
      take: request.take || 10,
    });
    return AdminGrpcMapper.toGetAdminUsersResponse(users, pageMeta);
  }

  @GrpcMethod('AuthService', 'GetAdminUser')
  async getAdminUser(request: GetAdminUserRequest): Promise<AdminUserReply> {
    const user = await this.userService.findById(request.id);
    return AdminGrpcMapper.toAdminUserReply(user);
  }

  @GrpcMethod('AuthService', 'ActivateAdminUser')
  async activateAdminUser(
    request: ActivateAdminUserRequest,
  ): Promise<AdminUserReply> {
    const user = request.activate
      ? await this.userService.activate(request.userId)
      : await this.userService.deactivate(request.userId);
    return AdminGrpcMapper.toAdminUserReply(user);
  }

  @GrpcMethod('AuthService', 'UpdateAdminUserRole')
  async updateAdminUserRole(
    request: UpdateAdminUserRoleRequest,
  ): Promise<AdminUserReply> {
    const user = this.userService.updateRole({ userId: request.userId });
    return AdminGrpcMapper.toAdminUserReply(user);
  }

  @GrpcMethod('AuthService', 'ChangeAdminPassword')
  async changeAdminPassword(
    request: ChangeAdminPasswordRequest,
  ): Promise<Empty> {
    await this.userService.changePassword(
      {
        name: request.name,
        email: request.email,
        password: request.password,
      },
      request.executorEmail,
    );
    return {};
  }

  @GrpcMethod('AuthService', 'RemoveAdminUser')
  async removeAdminUser(request: RemoveAdminUserRequest): Promise<Empty> {
    await this.userService.removeAdminUser(request.id, request.executorEmail);
    return {};
  }

  @GrpcMethod('AuthService', 'ValidateToken')
  validateToken(request: ValidateTokenRequest): ValidateTokenResponse {
    if (request.scheme !== 'bearer') {
      return { valid: false, session: undefined };
    }

    try {
      const decoded = jwt.verify(
        request.credential,
        process.env.ACCESS_TOKEN_SECRET,
      ) as any;
      return {
        valid: true,
        session: {
          id: '',
          uuid: decoded.uuid ?? String(decoded.id ?? ''),
          nickName: decoded.nickName ?? decoded.name ?? '',
          gameDbId: decoded.id ?? 0,
          database: 'game_db',
        },
      };
    } catch {
      return { valid: false, session: undefined };
    }
  }
}
