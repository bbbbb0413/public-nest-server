import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GatewayAuthGuard } from '../../auth/gateway-auth.guard';
import { AiServicePyHttpService } from './ai-service-py-http.service';

@ApiTags('ai')
@ApiBearerAuth('jwt')
@UseGuards(GatewayAuthGuard)
@Controller('ai/llm-gateway')
export class LlmGatewayProxyController {
  constructor(private readonly aiServicePy: AiServicePyHttpService) {}

  @Get('costs')
  @ApiOperation({ summary: '모델별 LLM 비용 조회 (ai-service-py 프록시)' })
  async getCosts(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<unknown> {
    return this.aiServicePy.get({
      method: 'llm-gateway/costs',
      params: { from, to },
    });
  }

  @Get('breakers')
  @ApiOperation({ summary: 'Circuit Breaker 상태 조회 (ai-service-py 프록시)' })
  async getBreakerStatuses(): Promise<unknown> {
    return this.aiServicePy.get({ method: 'llm-gateway/breakers' });
  }
}
