import { Body, Controller, Delete, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Session } from '@libs/shared-kernel';
import { GatewayAuthGuard } from '../../auth/gateway-auth.guard';
import { AiServicePyHttpService } from './ai-service-py-http.service';
import { SaveMyPromptInDto } from './dto/save-my-prompt-in.dto';

interface AuthenticatedRequest extends Request {
  session: Session;
}

// RAG Q&A에 실제로 사용되는 프롬프트 이름. ai-service-py의 RAG_PROMPT_NAME과 동일해야 한다.
const RAG_PROMPT_NAME = 'rag-qa-system';

@ApiTags('ai')
@ApiBearerAuth('jwt')
@UseGuards(GatewayAuthGuard)
@Controller('ai/my-prompt')
export class MyPromptProxyController {
  constructor(private readonly aiServicePy: AiServicePyHttpService) {}

  @Get()
  @ApiOperation({
    summary: '내 시스템 프롬프트 조회 (개인 설정이 없으면 관리자 기본값)',
  })
  async getMine(@Req() req: AuthenticatedRequest): Promise<unknown> {
    return this.aiServicePy.get({
      method: `prompts/${RAG_PROMPT_NAME}/active`,
      params: { userId: req.session.uuid },
    });
  }

  @Post()
  @ApiOperation({ summary: '내 시스템 프롬프트 저장 후 즉시 적용' })
  async saveMine(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SaveMyPromptInDto,
  ): Promise<unknown> {
    const userId = req.session.uuid;
    const variables = [
      ...new Set(Array.from(dto.content.matchAll(/\{\{(\w+)\}\}/g), (m) => m[1])),
    ];
    const created = (await this.aiServicePy.post({
      method: 'prompts',
      data: { name: RAG_PROMPT_NAME, content: dto.content, variables, userId },
    })) as { version: number };

    return this.aiServicePy.patch({
      method: `prompts/${RAG_PROMPT_NAME}/${created.version}/activate`,
      params: { userId },
    });
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: '내 시스템 프롬프트를 관리자 기본값으로 초기화' })
  async resetMine(@Req() req: AuthenticatedRequest): Promise<void> {
    await this.aiServicePy.delete({
      method: `prompts/${RAG_PROMPT_NAME}/active`,
      params: { userId: req.session.uuid },
    });
  }
}
