import { EntityRepository } from '@libs/common/databases/typeorm/typeorm-ex.decorator';
import { AbstractRepository } from '@libs/common/databases/typeorm/abstract.repository';
import { GameAccountOrmEntity } from '../orm/game-account.orm-entity';
import { IGameAccountRepository } from '../../domain/repository/game-account.repository';
import { GameAccount } from '../../domain/model/game-account';
import { GameAccountMapper } from '../mapper/game-account.mapper';

@EntityRepository(GameAccountOrmEntity)
export class GameAccountRepositoryImpl
  extends AbstractRepository<GameAccountOrmEntity>
  implements IGameAccountRepository
{
  async findByUuid(uuid: string): Promise<GameAccount | null> {
    const orm = await this.queryBuilder
      .where(`${this.alias}.uuid = :uuid`, { uuid })
      .getOne();
    return orm ? GameAccountMapper.toDomain(orm) : null;
  }

  async persist(account: GameAccount): Promise<GameAccount> {
    const orm = GameAccountMapper.toOrmEntity(account);
    const saved = await super.save(orm);
    return GameAccountMapper.toDomain(saved as GameAccountOrmEntity);
  }
}
