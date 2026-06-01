import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiResponseEntity } from '@libs/common/decorator/api-response-entity';
import { ResponseEntity } from '@libs/common/network/response-entity';
import { LoginInDto } from './dto/login-in.dto';
import { LoginOutDto } from './dto/login-out.dto';
import { LoginUseCase } from '../application/login.use-case';
import { LoginCommand } from '../application/command/login.command';

@ApiTags('Login')
@Controller('login')
export class LoginController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Post('login')
  @ApiResponseEntity({ type: LoginOutDto, summary: '게임 유저 로그인' })
  async login(@Body() dto: LoginInDto): Promise<ResponseEntity<LoginOutDto>> {
    const account = await this.loginUseCase.execute(new LoginCommand(dto.uuid));
    return ResponseEntity.ok().body(LoginOutDto.fromDomain(account));
  }
}
