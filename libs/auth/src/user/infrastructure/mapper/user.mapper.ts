import { User } from '../../domain/model/user';
import { UserOrmEntity } from '../orm/user.orm-entity';

export class UserMapper {
  static toDomain(orm: UserOrmEntity): User {
    return User.restore({
      id: orm.id,
      name: orm.name,
      email: orm.email,
      password: orm.password,
      activatedAt: orm.activatedAt ?? null,
    });
  }

  static toOrmEntity(domain: User): UserOrmEntity {
    const orm = new UserOrmEntity();
    if (domain.id !== undefined) orm.id = domain.id;
    orm.name = domain.name;
    orm.email = domain.email.getValue();
    orm.password = domain.password.getHashed();
    orm.activatedAt = domain.activatedAt;
    return orm;
  }
}
