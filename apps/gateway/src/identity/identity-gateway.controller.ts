import { Body, Controller, Get, Inject, OnModuleInit, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { GatewayAuthGuard } from '../auth/gateway-auth.guard';
import { Public } from '../auth/public.decorator';
import { IdentityServiceClient, LoginResponse, GameAccountReply, SendMailResponse, toMetadata } from '@libs/rpc';
import { LoginDto } from './dto/login.dto';
import { SendMailDto } from './dto/send-mail.dto';
import { ResponseEntity } from '@libs/common/network/response-entity';
import { ApiResponseEntity } from '@libs/common/decorator/api-response-entity';

@ApiTags('Identity')
@Controller()
export class IdentityGatewayController implements OnModuleInit {
  private identityService: IdentityServiceClient;

  constructor(
    @Inject('IDENTITY_SERVICE') private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.identityService = this.client.getService<IdentityServiceClient>('IdentityService');
  }

  @Public()
  @Post('auth/login')
  @ApiResponseEntity({ type: Object, summary: '게임 유저 로그인' })
  async login(@Body() dto: LoginDto): Promise<ResponseEntity<LoginResponse>> {
    const reply = await firstValueFrom(
      this.identityService.login({ uuid: dto.uuid }),
    );
    return ResponseEntity.ok().body(reply);
  }

  @ApiBearerAuth('jwt')
  @UseGuards(GatewayAuthGuard)
  @Get('accounts/:uuid')
  @ApiResponseEntity({ type: Object, summary: '게임 유저 정보 조회' })
  async getGameAccount(
    @Req() req: any,
    @Param('uuid') uuid: string,
  ): Promise<ResponseEntity<GameAccountReply>> {
    const session = req.session;
    const metadata = toMetadata(session);

    const reply = await firstValueFrom(
      this.identityService.getGameAccount({ uuid }, metadata),
    );
    return ResponseEntity.ok().body(reply);
  }

  @ApiBearerAuth('jwt')
  @UseGuards(GatewayAuthGuard)
  @Post('mails')
  @ApiResponseEntity({ type: Object, summary: '메일 발송' })
  async sendMail(
    @Req() req: any,
    @Body() dto: SendMailDto,
  ): Promise<ResponseEntity<SendMailResponse>> {
    const session = req.session;
    const metadata = toMetadata(session);

    const reply = await firstValueFrom(
      this.identityService.sendMail(
        {
          accountId: dto.accountId,
          title: dto.title,
          body: dto.body,
        },
        metadata,
      ),
    );
    return ResponseEntity.ok().body(reply);
  }
}
