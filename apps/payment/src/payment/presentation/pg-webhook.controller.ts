import {
  Body,
  Controller,
  Headers,
  Inject,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PgWebhookDto } from './dto/pg-webhook.dto';
import { HandlePgWebhookUseCase } from '../application/handle-pg-webhook.use-case';
import { HandlePgWebhookCommand } from '../application/command/handle-pg-webhook.command';
import { IPgAdapter } from '../domain/port/pg-adapter.port';

@ApiTags('Payment')
@Controller('payment/webhook')
export class PgWebhookController {
  constructor(
    private readonly handlePgWebhookUseCase: HandlePgWebhookUseCase,
    @Inject(IPgAdapter) private readonly pgAdapter: IPgAdapter,
  ) {}

  @Post('pg')
  async handlePgWebhook(
    @Body() dto: PgWebhookDto,
    @Headers('x-pg-signature') signature: string,
  ): Promise<{ received: true }> {
    const valid = this.pgAdapter.verifyWebhookSignature(
      {
        pgTransactionId: dto.pgTransactionId,
        paymentId: dto.paymentId,
        status: dto.status,
      },
      signature,
    );
    if (!valid) {
      throw new UnauthorizedException('웹훅 서명이 유효하지 않습니다.');
    }

    await this.handlePgWebhookUseCase.execute(
      new HandlePgWebhookCommand(
        dto.paymentId,
        dto.pgTransactionId,
        dto.status === 'APPROVED',
      ),
    );

    return { received: true };
  }
}
