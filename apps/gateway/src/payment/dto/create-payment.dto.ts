import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    description: '클라이언트가 생성하는 요청 고유 키. 재시도 시에도 동일 키를 보내면 중복 결제를 방지한다.',
  })
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}
