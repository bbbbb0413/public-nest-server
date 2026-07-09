import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import {
  ILlmCostLogRepository,
  LlmCostLogRepository,
} from '../domain/repository/llm-cost-log.repository';
import {
  ICircuitBreakerPort,
  CircuitBreakerPort,
} from '../domain/port/circuit-breaker.port';
import {
  BreakerStatusOutDto,
  CostSummaryOutDto,
} from './dto/cost-summary-out.dto';

@ApiTags('LLM Gateway')
@Controller('llm-gateway')
export class LlmCostController {
  constructor(
    @Inject(LlmCostLogRepository)
    private readonly costLogRepo: ILlmCostLogRepository,
    @Inject(CircuitBreakerPort)
    private readonly breaker: ICircuitBreakerPort,
    private readonly configService: ConfigService,
  ) {}

  @Get('costs')
  @ApiOperation({ summary: '모델별 LLM 비용 조회' })
  async getCosts(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<CostSummaryOutDto> {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    const items = await this.costLogRepo.sumByModel(fromDate, toDate);
    return CostSummaryOutDto.of(items, fromDate, toDate);
  }

  @Get('breakers')
  @ApiOperation({ summary: 'Circuit Breaker 상태 조회' })
  async getBreakerStatuses(): Promise<BreakerStatusOutDto[]> {
    const raw = this.configService.get<string>('LLM_FALLBACK_CHAIN') ?? '';
    const models = raw
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);

    const statuses = await Promise.all(
      models.map(async (model) => {
        const snap = await this.breaker.getState(model);
        const dto = new BreakerStatusOutDto();
        dto.model = snap.model;
        dto.status = snap.status;
        dto.failureCount = snap.failureCount;
        dto.openedAt = snap.openedAt;
        return dto;
      }),
    );
    return statuses;
  }
}
