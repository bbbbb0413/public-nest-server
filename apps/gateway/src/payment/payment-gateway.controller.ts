import { Body, Controller, Get, Inject, OnModuleInit, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { GatewayAuthGuard } from '../auth/gateway-auth.guard';
import { PaymentServiceClient, PaymentReply, toMetadata } from '@libs/rpc';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ResponseEntity } from '@libs/common/network/response-entity';
import { ApiResponseEntity } from '@libs/common/decorator/api-response-entity';

@ApiTags('Payment')
@ApiBearerAuth('jwt')
@UseGuards(GatewayAuthGuard)
@Controller('payments')
export class PaymentGatewayController implements OnModuleInit {
  private paymentService: PaymentServiceClient;

  constructor(
    @Inject('PAYMENT_SERVICE') private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.paymentService = this.client.getService<PaymentServiceClient>('PaymentService');
  }

  @Post()
  @ApiResponseEntity({ type: Object, summary: '결제 생성' })
  async createPayment(
    @Req() req: any,
    @Body() dto: CreatePaymentDto,
  ): Promise<ResponseEntity<PaymentReply>> {
    const session = req.session;
    const metadata = toMetadata(session);

    const reply = await firstValueFrom(
      this.paymentService.createPayment(
        {
          accountId: session.gameDbId,
          amount: dto.amount,
          currency: dto.currency,
          productId: dto.productId,
        },
        metadata,
      ),
    );

    return ResponseEntity.ok().body(reply);
  }

  @Get(':id')
  @ApiResponseEntity({ type: Object, summary: '결제 조회' })
  async getPayment(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseEntity<PaymentReply>> {
    const session = req.session;
    const metadata = toMetadata(session);

    const reply = await firstValueFrom(
      this.paymentService.getPayment({ paymentId: id }, metadata),
    );

    return ResponseEntity.ok().body(reply);
  }
}
