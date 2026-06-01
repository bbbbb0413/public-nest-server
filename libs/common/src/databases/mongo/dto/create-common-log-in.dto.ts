import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCommonLogInDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  gameCd: string;

  @ApiProperty()
  @IsNotEmpty()
  data: string;
}
