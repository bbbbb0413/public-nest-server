import { Mail } from '../../domain/model/mail';
import { MailOrmEntity } from '../orm/mail.orm-entity';

export class MailMapper {
  static toDomain(orm: MailOrmEntity): Mail {
    return Mail.restore({
      id: orm.id,
      userId: orm.userId,
      type: orm.type,
      contents: orm.contents,
    });
  }

  static toOrmEntity(domain: Mail): MailOrmEntity {
    const orm = new MailOrmEntity();
    if (domain.id !== undefined) orm.id = domain.id;
    orm.userId = domain.userId;
    orm.type = domain.type;
    orm.contents = domain.contents;
    return orm;
  }
}
