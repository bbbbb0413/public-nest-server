import { ApiProperty } from '@nestjs/swagger';

export class ApiUserLevelLockDto {
  @ApiProperty()
  database: string;

  @ApiProperty()
  id: string | number;

  constructor(partial?: Partial<ApiUserLevelLockDto>) {
    Object.assign(this, partial);
  }
}
