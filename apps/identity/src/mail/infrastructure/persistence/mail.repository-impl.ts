import { EntityRepository } from '@libs/common/databases/typeorm/typeorm-ex.decorator';
import { AbstractRepository } from '@libs/common/databases/typeorm/abstract.repository';
import { MailOrmEntity } from '../orm/mail.orm-entity';
import { IMailRepository } from '../../domain/repository/mail.repository';
import { Mail } from '../../domain/model/mail';
import { MailMapper } from '../mapper/mail.mapper';

@EntityRepository(MailOrmEntity)
export class MailRepositoryImpl
  extends AbstractRepository<MailOrmEntity>
  implements IMailRepository
{
  async persist(mail: Mail): Promise<Mail> {
    const orm = MailMapper.toOrmEntity(mail);
    const saved = await super.save(orm);
    return MailMapper.toDomain(saved as MailOrmEntity);
  }
}
