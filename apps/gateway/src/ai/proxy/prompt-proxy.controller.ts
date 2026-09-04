import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Session } from '@libs/shared-kernel';
import { GatewayAuthGuard } from '../../auth/gateway-auth.guard';
import { AdminGuard } from '../../auth/admin.guard';
import { AiServicePyHttpService } from './ai-service-py-http.service';
import { CreatePromptInDto } from './dto/create-prompt-in.dto';

interface AuthenticatedRequest extends Request {
  session: Session;
}

@ApiTags('ai')
@ApiBearerAuth('jwt')
@UseGuards(GatewayAuthGuard)
@Controller('ai/prompts')
export class PromptProxyController {
  constructor(private readonly aiServicePy: AiServicePyHttpService) {}

  @Post()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '프롬프트 신규 버전 생성 (ai-service-py 프록시)' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePromptInDto,
  ): Promise<unknown> {
    return this.aiServicePy.post({
      method: 'prompts',
      data: {
        ...dto,
        userId: dto.userId ?? req.session?.uuid,
      },
    });
  }

  @Get(':name')
  @ApiOperation({
    summary: '특정 이름의 버전 목록 조회 (ai-service-py 프록시)',
  })
  async list(
    @Param('name') name: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.aiServicePy.get({
      method: `prompts/${name}`,
      params: { userId: req.session?.uuid },
    });
  }

  @Get(':name/active')
  @ApiOperation({ summary: '현재 활성 버전 조회 (ai-service-py 프록시)' })
  async getActive(
    @Param('name') name: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.aiServicePy.get({
      method: `prompts/${name}/active`,
      params: { userId: req.session?.uuid },
    });
  }

  @Patch(':name/:version/activate')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '특정 버전 활성화 (ai-service-py 프록시)' })
  async activate(
    @Param('name') name: string,
    @Param('version') version: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.aiServicePy.patch({
      method: `prompts/${name}/${version}/activate`,
      params: { userId: req.session?.uuid },
    });
  }

  @Delete(':name/active')
  @HttpCode(204)
  @ApiOperation({ summary: '활성 프롬프트 비활성화 (ai-service-py 프록시)' })
  async deactivateActive(
    @Param('name') name: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.aiServicePy.delete({
      method: `prompts/${name}/active`,
      params: { userId: req.session?.uuid },
    });
  }

  @Delete(':name/:version')
  @HttpCode(204)
  @ApiOperation({ summary: '특정 버전 프롬프트 삭제 (ai-service-py 프록시)' })
  async deleteVersion(
    @Param('name') name: string,
    @Param('version') version: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.aiServicePy.delete({
      method: `prompts/${name}/${version}`,
      params: { userId: req.session?.uuid },
    });
  }
}

