import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Session } from '@libs/shared-kernel';
import { GatewayAuthGuard } from '../../auth/gateway-auth.guard';
import { AiServicePyHttpService } from './ai-service-py-http.service';

interface AuthenticatedRequest extends Request {
  session: Session;
}

@ApiTags('ai')
@ApiBearerAuth('jwt')
@UseGuards(GatewayAuthGuard)
@Controller('ai/rag/sessions')
export class RagSessionProxyController {
  constructor(private readonly aiServicePy: AiServicePyHttpService) {}

  @Get()
  @ApiOperation({ summary: '유저 대화 세션 목록 조회 (ai-service-py 프록시)' })
  async getSessions(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    return this.aiServicePy.get({
      method: 'rag/sessions',
      params: { userId: req.session.uuid, page, limit },
    });
  }

  @Get(':sessionId')
  @ApiOperation({ summary: '대화 세션 상세 조회 (ai-service-py 프록시)' })
  async getSession(@Param('sessionId') sessionId: string): Promise<unknown> {
    return this.aiServicePy.get({ method: `rag/sessions/${sessionId}` });
  }

  @Delete(':sessionId')
  @HttpCode(204)
  @ApiOperation({ summary: '대화 세션 삭제 (ai-service-py 프록시)' })
  async deleteSession(@Param('sessionId') sessionId: string): Promise<void> {
    await this.aiServicePy.delete({ method: `rag/sessions/${sessionId}` });
  }
}
