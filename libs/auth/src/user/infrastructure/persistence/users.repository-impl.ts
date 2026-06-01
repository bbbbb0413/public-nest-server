import { EntityRepository } from '@libs/common/databases/typeorm/typeorm-ex.decorator';
import { AbstractRepository } from '@libs/common/databases/typeorm/abstract.repository';
import { UserOrmEntity } from '../orm/user.orm-entity';
import { IUsersRepository } from '../../domain/repository/users.repository';
import { User } from '../../domain/model/user';
import { UserMapper } from '../mapper/user.mapper';

@EntityRepository(UserOrmEntity)
export class UsersRepositoryImpl
  extends AbstractRepository<UserOrmEntity>
  implements IUsersRepository
{
  async findUserById(id: number): Promise<User | null> {
    const orm = await this.queryBuilder
      .where(`${this.alias}.id = :id`, { id })
      .getOne();
    return orm ? UserMapper.toDomain(orm) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const orm = await this.queryBuilder
      .where(`${this.alias}.email = :email`, { email })
      .getOne();
    return orm ? UserMapper.toDomain(orm) : null;
  }

  async countByEmail(email: string): Promise<number> {
    return this.queryBuilder
      .where(`${this.alias}.email = :email`, { email })
      .getCount();
  }

  async findAllAndCount(
    take: number,
    skip: number,
    orderBy: 'ASC' | 'DESC',
  ): Promise<[User[], number]> {
    const [orms, count] = await this.queryBuilder
      .take(take)
      .skip(skip)
      .orderBy(`${this.alias}.id`, orderBy)
      .getManyAndCount();
    return [orms.map(UserMapper.toDomain), count];
  }

  async persist(user: User): Promise<User> {
    const orm = UserMapper.toOrmEntity(user);
    const saved = await super.save(orm);
    return UserMapper.toDomain(saved as UserOrmEntity);
  }

  async updatePasswordByEmail(
    email: string,
    hashedPassword: string,
  ): Promise<void> {
    await this.queryBuilder
      .update(this.alias)
      .set({ password: hashedPassword })
      .where(`${this.alias}.email = :email`, { email })
      .execute();
  }

  async activateById(id: number): Promise<number> {
    const result = await this.queryBuilder
      .update(this.alias)
      .set({ activatedAt: new Date() })
      .where(`${this.alias}.id = :id`, { id })
      .execute();
    return result.affected ?? 0;
  }

  async deactivateById(id: number): Promise<number> {
    const result = await this.queryBuilder
      .update(this.alias)
      .set({ activatedAt: null })
      .where(`${this.alias}.id = :id`, { id })
      .execute();
    return result.affected ?? 0;
  }

  async softDeleteById(id: number): Promise<void> {
    await super.deleteById(id);
  }
}
