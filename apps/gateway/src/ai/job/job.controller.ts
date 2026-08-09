import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
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
@Controller('ai/rag/jobs')
export class JobController {
  constructor(
    private readonly jobStore: JobStoreService,
    private readonly producer: AiKafkaProducerService,
  ) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({
    summary: 'RAG 질의응답 잡 발행 (Kafka 비동기 처리, 결과는 SSE로 수신)',
  })
  async createAskJob(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AskJobInDto,
  ): Promise<JobAcceptedOutDto> {
    const userId = req.session.uuid;
    const job = await this.jobStore.createJob(userId, 'rag.ask');

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
}
