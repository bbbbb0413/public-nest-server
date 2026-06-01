import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginInDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  uuid: string;
}
