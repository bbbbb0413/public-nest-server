import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber } from 'class-validator';

export class UpdateActivateUserDto {
  @ApiProperty()
  @IsNumber()
  userId: number;

  @ApiProperty()
  @IsBoolean()
  activate: boolean;
}
