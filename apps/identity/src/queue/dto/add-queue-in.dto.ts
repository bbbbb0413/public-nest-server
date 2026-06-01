import { ApiProperty } from '@nestjs/swagger';

export class AddQueueInDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  email: number;

  @ApiProperty()
  password: number;
}
