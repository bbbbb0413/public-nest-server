import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  OnModuleInit,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { AuthServiceClient, AdminUserReply } from '@libs/rpc';
import { PageOptionsDto } from '@libs/common/pagination/dto/page-options.dto';
import { ResponseEntity } from '@libs/common/network/response-entity';
import { ApiResponseEntity } from '@libs/common/decorator/api-response-entity';
import { GatewayAuthGuard } from '../auth/gateway-auth.guard';
import {
  AdminLoginInDto,
  AdminSignupInDto,
  UpdateActivateUserInDto,
  UpdateRoleUserInDto,
} from './dto/admin-request.dto';

@ApiTags('Admin')
@Controller('admin')
export class AdminGatewayController implements OnModuleInit {
  private adminService: AuthServiceClient;

  constructor(
    @Inject('ADMIN_SERVICE') private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.adminService = this.client.getService<AuthServiceClient>('AuthService');
  }

  // gRPC int64/optional 필드가 문자열이나 합성 oneof 프로퍼티로 새어나오는 것을 막고
  // 프론트가 기대하는 깨끗한 형태로 다시 만든다.
  private toUserJson(user: AdminUserReply) {
    return {
      id: Number(user.id),
      name: user.name,
      email: user.email,
      activatedAt: user.activatedAt ? new Date(Number(user.activatedAt)) : null,
    };
  }

  @Post('auth/signup')
  @ApiResponseEntity({ summary: '어드민 회원가입' })
  async signup(@Body() dto: AdminSignupInDto): Promise<ResponseEntity<unknown>> {
    const user = await firstValueFrom(this.adminService.signup(dto));
    return ResponseEntity.ok().body(this.toUserJson(user));
  }

  @Post('auth/login')
  @ApiResponseEntity({ summary: '어드민 로그인' })
  async login(@Body() dto: AdminLoginInDto): Promise<ResponseEntity<unknown>> {
    const result = await firstValueFrom(this.adminService.adminLogin(dto));
    return ResponseEntity.ok().body({
      authToken: result.token,
      ...this.toUserJson(result.user),
    });
  }

  @ApiBearerAuth('jwt')
  @UseGuards(GatewayAuthGuard)
  @Get('user')
  @ApiResponseEntity({ isPagination: true, summary: '전체 관리자 정보' })
  async findAll(
    @Query() pageOptionsDto: PageOptionsDto,
  ): Promise<ResponseEntity<unknown>> {
    const result = await firstValueFrom(
      this.adminService.getAdminUsers({
        page: pageOptionsDto.page,
        take: pageOptionsDto.take,
        order: pageOptionsDto.order,
      }),
    );
    return ResponseEntity.ok()
      .body(result.users.map((u) => this.toUserJson(u)))
      .setPageMeta({
        page: result.page,
        take: result.take,
        itemCount: result.itemCount,
        pageCount: result.pageCount,
        hasPreviousPage: result.hasPreviousPage,
        hasNextPage: result.hasNextPage,
      });
  }

  @ApiBearerAuth('jwt')
  @UseGuards(GatewayAuthGuard)
  @Get('user/:id')
  @ApiResponseEntity({ summary: '관리자 정보' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseEntity<unknown>> {
    const user = await firstValueFrom(this.adminService.getAdminUser({ id }));
    return ResponseEntity.ok().body(this.toUserJson(user));
  }

  @ApiBearerAuth('jwt')
  @UseGuards(GatewayAuthGuard)
  @Put('user/activate')
  @ApiResponseEntity({ summary: '관리자 활성화 or 비활성화' })
  async activate(
    @Body() dto: UpdateActivateUserInDto,
  ): Promise<ResponseEntity<unknown>> {
    const user = await firstValueFrom(
      this.adminService.activateAdminUser({
        userId: dto.userId,
        activate: dto.activate,
      }),
    );
    return ResponseEntity.ok().body(this.toUserJson(user));
  }

  @ApiBearerAuth('jwt')
  @UseGuards(GatewayAuthGuard)
  @Put('user/role')
  @ApiResponseEntity({ summary: '관리자 권한 변경' })
  async updateRole(
    @Body() dto: UpdateRoleUserInDto,
  ): Promise<ResponseEntity<unknown>> {
    const user = await firstValueFrom(
      this.adminService.updateAdminUserRole({ userId: dto.userId }),
    );
    return ResponseEntity.ok().body(this.toUserJson(user));
  }

  @ApiBearerAuth('jwt')
  @UseGuards(GatewayAuthGuard)
  @Post('user/change/password')
  @ApiResponseEntity({ summary: '어드민 비밀번호 변경' })
  async changePassword(
    @Body() dto: AdminSignupInDto,
    @Req() req: any,
  ): Promise<ResponseEntity<unknown>> {
    await firstValueFrom(
      this.adminService.changeAdminPassword({
        name: dto.name,
        email: dto.email,
        password: dto.password,
        executorEmail: req.user?.email,
      }),
    );
    return ResponseEntity.ok().build();
  }

  @ApiBearerAuth('jwt')
  @UseGuards(GatewayAuthGuard)
  @Delete('user/:id')
  @ApiResponseEntity({ summary: '어드민 유저 삭제' })
  async removeAdminUser(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ): Promise<ResponseEntity<unknown>> {
    await firstValueFrom(
      this.adminService.removeAdminUser({ id, executorEmail: req.user?.email }),
    );
    return ResponseEntity.ok().build();
  }
}
