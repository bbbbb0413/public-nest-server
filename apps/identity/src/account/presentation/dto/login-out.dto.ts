import { ApiProperty } from '@nestjs/swagger';
import { GameAccount } from '../../domain/model/game-account';

export class LoginOutDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  nickName: string;

  static fromDomain(account: GameAccount): LoginOutDto {
    const dto = new LoginOutDto();
    dto.id = account.id;
    dto.uuid = account.uuid.getValue();
    dto.nickName = account.nickName.getValue();
    return dto;
  }
}
