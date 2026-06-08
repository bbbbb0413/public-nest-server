import { Module } from '@nestjs/common';
import { TypeOrmExModule } from '@libs/common/databases/typeorm/typeorm-ex.module';
import PersonalDatabaseConfig from '@libs/common/config/database/personal-database.config';
import { IMailRepository } from './domain/repository/mail.repository';
import { MailRepositoryImpl } from './infrastructure/persistence/mail.repository-impl';

@Module({
  imports: [
    TypeOrmExModule.forFeatures(
      [MailRepositoryImpl],
      [PersonalDatabaseConfig().name],
    ),
  ],
  providers: [{ provide: IMailRepository, useExisting: MailRepositoryImpl }],
  exports: [IMailRepository],
})
export class MailModule {}
