import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Session } from '@libs/shared-kernel';
import { GatewayAuthGuard } from '../../auth/gateway-auth.guard';
import { AiServicePyHttpService } from './ai-service-py-http.service';
import { SubmitAnswerFeedbackInDto } from './dto/submit-answer-feedback-in.dto';

interface AuthenticatedRequest extends Request {
  session: Session;
}

@ApiTags('ai')
@ApiBearerAuth('jwt')
@UseGuards(GatewayAuthGuard)
@Controller('ai/feedback')
export class AnswerFeedbackProxyController {
  constructor(private readonly aiServicePy: AiServicePyHttpService) {}

  @Post()
  @ApiOperation({
    summary: '답변 평가 제출 (이미 평가한 답변이면 갱신)',
  })
  async submit(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SubmitAnswerFeedbackInDto,
  ): Promise<unknown> {
    // userId 는 인증 세션에서만 채운다. 본문으로 받으면 남의 이름으로 평가를 남길 수 있다.
    return this.aiServicePy.post({
      method: 'rag/feedback',
      data: dto,
      params: { userId: req.session.uuid },
    });
  }

  @Get()
  @ApiOperation({ summary: '한 세션에서 내가 남긴 답변 평가 목록' })
  async getMine(
    @Req() req: AuthenticatedRequest,
    @Query('sessionId') sessionId: string,
  ): Promise<unknown> {
    return this.aiServicePy.get({
      method: 'rag/feedback',
      params: { sessionId, userId: req.session.uuid },
    });
  }
}
