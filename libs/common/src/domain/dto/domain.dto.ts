import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from './base.dto';
import { Exclude } from 'class-transformer';
import { Domain } from '@libs/common/domain/domain';

export abstract class DomainDto extends BaseDto implements Domain {
  @ApiProperty()
  id?: number;

  @Exclude()
  createdAt: Date;

  @Exclude()
  updatedAt: Date;
}
