import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Session } from '@libs/shared-kernel';
import { GatewayAuthGuard } from '../../auth/gateway-auth.guard';
import { AiKafkaProducerService } from '../kafka/ai-kafka-producer.service';
import { JobStoreService } from './job-store.service';
import { AskJobInDto } from './dto/ask-job-in.dto';
import { JobAcceptedOutDto } from './dto/job-accepted-out.dto';

interface AuthenticatedRequest extends Request {
  session: Session;
}

@ApiTags('ai')
@ApiBearerAuth('jwt')
@UseGuards(GatewayAuthGuard)
@Controller('ai')
export class JobController {
  constructor(
    private readonly jobStore: JobStoreService,
    private readonly producer: AiKafkaProducerService,
  ) {}

  @Post('rag/jobs')
  @HttpCode(202)
  @ApiOperation({
    summary: 'RAG 질의응답 잡 발행 (Kafka 비동기 처리, 결과는 SSE로 수신)',
  })
  async createAskJob(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AskJobInDto,
  ): Promise<JobAcceptedOutDto> {
    const userId = req.session.uuid;
    const { job, isNew } = await this.jobStore.createJob(
      userId,
      'rag.ask',
      dto.idempotencyKey,
    );

    if (!isNew) {
      // 멱등키로 이미 존재하는 잡을 반환한 경우 — 재발행하지 않는다.
      return { jobId: job.jobId };
    }

    await this.producer.publishAskRequested({
      jobId: job.jobId,
      userId,
      question: dto.question,
      topK: dto.topK,
      useHyde: dto.useHyde,
      sessionId: dto.sessionId,
      conversationHistory: dto.conversationHistory,
    });

    return { jobId: job.jobId };
  }

  @Delete(['jobs/:jobId', 'rag/jobs/:jobId'])
  @HttpCode(200)
  @ApiOperation({
    summary: 'AI 잡 생성 중단 요청',
  })
  async cancelJob(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
  ): Promise<void> {
    const job = await this.jobStore.getJob(jobId);
    if (!job) {
      return;
    }

    if (job.userId !== req.session.uuid) {
      throw new ForbiddenException('본인이 발행한 잡만 취소할 수 있습니다.');
    }

    if (job.status === 'done' || job.status === 'error' || job.status === 'cancelled') {
      return;
    }

    await this.jobStore.cancelJob(jobId);
  }
}
