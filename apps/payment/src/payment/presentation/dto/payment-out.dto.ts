import { ApiProperty } from '@nestjs/swagger';
import { Payment } from '../../domain/model/payment';

export class PaymentOutDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  userId: number;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  paymentMethod: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  quantity: string;

  static fromDomain(payment: Payment): PaymentOutDto {
    const dto = new PaymentOutDto();
    dto.id = payment.id;
    dto.userId = payment.userId;
    dto.amount = payment.money.getAmount();
    dto.currency = payment.money.getCurrency();
    dto.paymentMethod = payment.paymentMethod;
    dto.productId = payment.productId;
    dto.quantity = payment.quantity;
    return dto;
  }
}
