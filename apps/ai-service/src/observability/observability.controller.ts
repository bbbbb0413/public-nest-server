import { Controller, Get, Query } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  RagasEvaluationDoc,
  RagasEvaluationRepositoryImpl,
} from './infrastructure/persistence/ragas-evaluation.repository-impl';

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

@ApiTags('observability')
@Controller('observability')
export class ObservabilityController {
  constructor(
    private readonly repo: RagasEvaluationRepositoryImpl,
    @InjectQueue('ingest') private readonly ingestQueue: Queue,
    @InjectQueue('ragas-eval') private readonly ragasQueue: Queue,
  ) {}

  @Get('ragas-evals')
  @ApiOperation({ summary: 'RAGAS 평가 최근 결과 조회' })
  async getEvals(
    @Query('limit') limit = '20',
  ): Promise<{ data: RagasEvaluationDoc[] }> {
    const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const docs = await this.repo.findRecent(limitNum);
    return { data: docs };
  }

  @Get('queues')
  @ApiOperation({ summary: 'Bull 큐 상태 조회' })
  async getQueueStatus(): Promise<{ data: Record<string, QueueStats> }> {
    const [ingestStats, ragasStats] = await Promise.all([
      this.collectStats(this.ingestQueue),
      this.collectStats(this.ragasQueue),
    ]);
    return { data: { ingest: ingestStats, 'ragas-eval': ragasStats } };
  }

  private async collectStats(queue: Queue): Promise<QueueStats> {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  }
}
