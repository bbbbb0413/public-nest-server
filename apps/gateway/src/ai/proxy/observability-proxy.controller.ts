import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GatewayAuthGuard } from '../../auth/gateway-auth.guard';
import { AiServicePyHttpService } from './ai-service-py-http.service';

@ApiTags('ai')
@ApiBearerAuth('jwt')
@UseGuards(GatewayAuthGuard)
@Controller('ai/observability')
export class ObservabilityProxyController {
  constructor(private readonly aiServicePy: AiServicePyHttpService) {}

  @Get('ragas-evals')
  @ApiOperation({ summary: 'RAGAS 평가 최근 결과 조회 (ai-service-py 프록시)' })
  async getEvals(@Query('limit') limit?: string): Promise<unknown> {
    return this.aiServicePy.get({
      method: 'observability/ragas-evals',
      params: { limit },
    });
  }
}
