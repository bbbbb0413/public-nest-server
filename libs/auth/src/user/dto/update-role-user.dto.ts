import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class UpdateRoleUserDto {
  @ApiProperty()
  @IsNumber()
  userId: number;
}
