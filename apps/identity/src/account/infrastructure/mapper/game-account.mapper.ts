import { GameAccount } from '../../domain/model/game-account';
import { GameAccountOrmEntity } from '../orm/game-account.orm-entity';

export class GameAccountMapper {
  static toDomain(orm: GameAccountOrmEntity): GameAccount {
    return GameAccount.restore({
      id: orm.id,
      uuid: orm.uuid,
      nickName: orm.nickName,
    });
  }

  static toOrmEntity(domain: GameAccount): GameAccountOrmEntity {
    const orm = new GameAccountOrmEntity();
    if (domain.id !== undefined) orm.id = domain.id;
    orm.uuid = domain.uuid.getValue();
    orm.nickName = domain.nickName.getValue();
    return orm;
  }
}
