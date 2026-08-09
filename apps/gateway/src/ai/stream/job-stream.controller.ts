import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Session } from '@libs/shared-kernel';
import { GatewayAuthGuard } from '../../auth/gateway-auth.guard';
import { JobStoreService } from '../job/job-store.service';
import { RedisStreamsRelayService } from './redis-streams-relay.service';

interface AuthenticatedRequest extends Request {
  session: Session;
}

const TERMINAL_EVENT_TYPES = new Set(['done', 'error']);

@ApiTags('ai')
@ApiBearerAuth('jwt')
@UseGuards(GatewayAuthGuard)
@Controller('ai/jobs')
export class JobStreamController {
  constructor(
    private readonly jobStore: JobStoreService,
    private readonly relay: RedisStreamsRelayService,
  ) {}

  @Get(':jobId/stream')
  @ApiOperation({
    summary: '잡 결과 SSE 구독 (Redis Streams 릴레이, Last-Event-ID 재생 지원)',
  })
  async stream(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Param('jobId') jobId: string,
    @Headers('last-event-id') lastEventId?: string,
  ): Promise<void> {
    const job = await this.jobStore.getJob(jobId);
    if (!job) {
      throw new NotFoundException('존재하지 않거나 만료된 잡입니다.');
    }
    if (job.userId !== req.session.uuid) {
      throw new ForbiddenException('본인이 발행한 잡만 구독할 수 있습니다.');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let stopped = false;
    req.on('close', () => {
      stopped = true;
    });

    let lastId = lastEventId ?? '0';

    try {
      while (!stopped) {
        const events = await this.relay.readNext(jobId, lastId);

        for (const event of events) {
          lastId = event.id;
          res.write(
            `id: ${event.id}\ndata: ${JSON.stringify({ type: event.type, data: event.data })}\n\n`,
          );

          if (TERMINAL_EVENT_TYPES.has(event.type)) {
            stopped = true;
            break;
          }
        }
      }
    } finally {
      res.end();
    }
  }
}
