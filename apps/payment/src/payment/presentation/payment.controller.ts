import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiResponseEntity } from '@libs/common/decorator/api-response-entity';
import { ResponseEntity } from '@libs/common/network/response-entity';
import { CreatePaymentInDto } from './dto/create-payment-in.dto';
import { PaymentOutDto } from './dto/payment-out.dto';
import { CreatePaymentUseCase } from '../application/create-payment.use-case';
import { CreatePaymentCommand } from '../application/command/create-payment.command';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(private readonly createPaymentUseCase: CreatePaymentUseCase) {}

  @Post()
  @ApiResponseEntity({ type: PaymentOutDto, summary: '결제 생성' })
  async createPayment(
    @Body() dto: CreatePaymentInDto,
  ): Promise<ResponseEntity<PaymentOutDto>> {
    const payment = await this.createPaymentUseCase.execute(
      new CreatePaymentCommand(
        dto.userId,
        dto.amount,
        dto.currency,
        dto.paymentMethod,
        dto.productId,
        dto.quantity,
      ),
    );
    return ResponseEntity.ok().body(PaymentOutDto.fromDomain(payment));
  }
}
