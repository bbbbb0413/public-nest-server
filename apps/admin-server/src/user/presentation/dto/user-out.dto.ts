import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../domain/model/user';

export class UserOutDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  activatedAt: Date;

  static fromDomain(user: User): UserOutDto {
    const dto = new UserOutDto();
    dto.id = user.id;
    dto.name = user.name;
    dto.email = user.email.getValue();
    dto.activatedAt = user.activatedAt;
    return dto;
  }
}
