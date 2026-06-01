import { AbstractRepository } from '@libs/common/databases/typeorm/abstract.repository';

export abstract class AbstractUserRepository<
  Entity,
> extends AbstractRepository<Entity> {
  async findByUserKey(userKey: number): Promise<Entity>;
  async findByUserKey(userKey: number, isMany: boolean): Promise<Entity[]>;
  async findByUserKey(
    userKey: number,
    isMany?: boolean,
  ): Promise<Entity | Entity[]> {
    const queryBuilder = this.queryBuilder.where(
      `${this.alias}.userKey = :userKey`,
      { userKey },
    );

    return isMany ? await queryBuilder.getMany() : await queryBuilder.getOne();
  }
}
