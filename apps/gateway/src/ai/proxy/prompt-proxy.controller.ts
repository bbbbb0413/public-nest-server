import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GatewayAuthGuard } from '../../auth/gateway-auth.guard';
import { AdminGuard } from '../../auth/admin.guard';
import { AiServicePyHttpService } from './ai-service-py-http.service';
import { CreatePromptInDto } from './dto/create-prompt-in.dto';

@ApiTags('ai')
@ApiBearerAuth('jwt')
@UseGuards(GatewayAuthGuard)
@Controller('ai/prompts')
export class PromptProxyController {
  constructor(private readonly aiServicePy: AiServicePyHttpService) {}

  @Post()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '프롬프트 신규 버전 생성 (ai-service-py 프록시)' })
  async create(@Body() dto: CreatePromptInDto): Promise<unknown> {
    return this.aiServicePy.post({ method: 'prompts', data: dto });
  }

  @Get(':name')
  @ApiOperation({
    summary: '특정 이름의 버전 목록 조회 (ai-service-py 프록시)',
  })
  async list(@Param('name') name: string): Promise<unknown> {
    return this.aiServicePy.get({ method: `prompts/${name}` });
  }

  @Get(':name/active')
  @ApiOperation({ summary: '현재 활성 버전 조회 (ai-service-py 프록시)' })
  async getActive(
    @Param('name') name: string,
    @Query('userId') userId?: string,
  ): Promise<unknown> {
    return this.aiServicePy.get({
      method: `prompts/${name}/active`,
      params: { userId },
    });
  }

  @Patch(':name/:version/activate')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '특정 버전 활성화 (ai-service-py 프록시)' })
  async activate(
    @Param('name') name: string,
    @Param('version') version: string,
  ): Promise<unknown> {
    return this.aiServicePy.patch({
      method: `prompts/${name}/${version}/activate`,
    });
  }
}
