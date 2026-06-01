import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthSignUserInDto } from './dto/auth-sign-user-in.dto';
import { ResponseEntity } from '@libs/common/network/response-entity';
import { ApiResponseEntity } from '@libs/common/decorator/api-response-entity';
import { JwtPayload } from '@libs/common/constants/jwt.constants';
import { UserService } from '../user/user.service';
import { UserOutDto } from '../user/presentation/dto/user-out.dto';
import { AuthSignUserOutDto } from './dto/auth-sign-user-out.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @Post('/signup')
  @ApiResponseEntity({ type: UserOutDto, summary: '어드민 유저 가입' })
  async signup(
    @Body() adminUserInDto: AuthSignUserInDto,
  ): Promise<ResponseEntity<UserOutDto>> {
    const userDto = await this.userService.signup(adminUserInDto);
    return ResponseEntity.ok().body(userDto);
  }

  @Post('/login')
  @ApiResponseEntity({
    type: AuthSignUserOutDto,
    summary: '어드민 유저 로그인',
  })
  async login(
    @Body() loginDto: AuthSignUserInDto,
  ): Promise<ResponseEntity<AuthSignUserOutDto>> {
    const user = await this.authService.login(
      loginDto.email,
      loginDto.password,
    );
    const payload: JwtPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      activatedAt: user.activatedAt,
    };
    const authSignUserDto = AuthSignUserOutDto.of(user).setAuthToken(
      this.authService.makeAuthToken(payload),
    );
    return ResponseEntity.ok().body(authSignUserDto);
  }
}
