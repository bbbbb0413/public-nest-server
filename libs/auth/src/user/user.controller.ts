import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PageOptionsDto } from '@libs/common/pagination/dto/page-options.dto';
import { ResponseEntity } from '@libs/common/network/response-entity';
import { UpdateRoleUserDto } from './dto/update-role-user.dto';
import { UpdateActivateUserDto } from './dto/update-activate-user.dto';
import { ApiResponseEntity } from '@libs/common/decorator/api-response-entity';
import { CurrentUser } from '@libs/common/decorator/current-user.decorator';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { AuthSignUserInDto } from '../auth/dto/auth-sign-user-in.dto';
import { UserOutDto } from './presentation/dto/user-out.dto';

@ApiTags('user')
@Controller('user')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('/')
  @ApiResponseEntity({
    type: UserOutDto,
    isPagination: true,
    summary: '전체 관리자 정보 - pagination',
  })
  async findAll(
    @Query() pageOptionsDto: PageOptionsDto,
  ): Promise<ResponseEntity<UserOutDto[]>> {
    const [adminUsersDto, pageMetaDto] = await this.userService.findAll(
      pageOptionsDto,
    );
    return ResponseEntity.ok().body(adminUsersDto).setPageMeta(pageMetaDto);
  }

  @Get('/:id')
  @ApiResponseEntity({ type: UserOutDto, summary: '관리자 정보' })
  async findOne(@Param('id') id: number): Promise<ResponseEntity<UserOutDto>> {
    const userDto = await this.userService.findById(id);
    return ResponseEntity.ok().body(userDto);
  }

  @Put('/activate')
  @ApiResponseEntity({
    type: UserOutDto,
    summary: '관리자 활성화 or 비 활성화',
  })
  async activate(
    @Body() updateUserOutDto: UpdateActivateUserDto,
  ): Promise<ResponseEntity<UserOutDto>> {
    let userDto: UserOutDto;

    if (updateUserOutDto.activate) {
      userDto = await this.userService.activate(updateUserOutDto.userId);
    } else {
      userDto = await this.userService.deactivate(updateUserOutDto.userId);
    }
    return ResponseEntity.ok().body(userDto);
  }

  @Put('/role')
  @ApiResponseEntity({ type: UserOutDto, summary: '관리자 권한 변경' })
  async updateRole(
    @Body() updateRoleUserOutDto: UpdateRoleUserDto,
  ): Promise<ResponseEntity<UserOutDto>> {
    const userDto = await this.userService.updateRole(updateRoleUserOutDto);
    return ResponseEntity.ok().body(userDto);
  }

  @Post('/change/password')
  @ApiResponseEntity({ type: UserOutDto, summary: '어드민 비밀번호 변경' })
  async changePassword(
    @Body() adminUserInDto: AuthSignUserInDto,
    @CurrentUser() user: any,
  ): Promise<ResponseEntity<unknown>> {
    await this.userService.changePassword(adminUserInDto, user.email);
    return ResponseEntity.ok().build();
  }

  @Delete('/:id')
  @ApiResponseEntity({ summary: '어드민 유저 삭제' })
  async removeAdminUser(
    @Param('id') id: number,
    @CurrentUser() user: any,
  ): Promise<ResponseEntity<unknown>> {
    await this.userService.removeAdminUser(id, user.email);
    return ResponseEntity.ok().build();
  }
}
