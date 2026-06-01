import { ApiProperty } from '@nestjs/swagger';
import { UserOutDto } from '../../user/presentation/dto/user-out.dto';

export class AuthSignUserOutDto extends UserOutDto {
  @ApiProperty()
  authToken: string;

  setAuthToken(authToken: string): AuthSignUserOutDto {
    this.authToken = authToken;
    return this;
  }

  static of(userDto: UserOutDto): AuthSignUserOutDto {
    const dto = new AuthSignUserOutDto();
    dto.id = userDto.id;
    dto.name = userDto.name;
    dto.email = userDto.email;
    dto.activatedAt = userDto.activatedAt;
    return dto;
  }
}
