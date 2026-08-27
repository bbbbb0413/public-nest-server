import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class PgWebhookDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pgTransactionId: string;

  @ApiProperty()
  @IsNumber()
  paymentId: number;

  @ApiProperty({ enum: ['APPROVED', 'FAILED'] })
  @IsIn(['APPROVED', 'FAILED'])
  status: 'APPROVED' | 'FAILED';
}
