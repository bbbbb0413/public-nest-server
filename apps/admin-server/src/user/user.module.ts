import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmExModule } from '@libs/common/databases/typeorm/typeorm-ex.module';
import PersonalDatabaseConfig from '@libs/common/config/database/personal-database.config';
import { UsersRepositoryImpl } from './infrastructure/persistence/users.repository-impl';
import { IUsersRepository } from './domain/repository/users.repository';
import { UserService } from './user.service';

@Module({
  imports: [
    TypeOrmExModule.forFeatures(
      [UsersRepositoryImpl],
      [PersonalDatabaseConfig().name],
    ),
    BullModule.registerQueue({
      name: 'mail',
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  providers: [
    UserService,
    { provide: IUsersRepository, useExisting: UsersRepositoryImpl },
  ],
  exports: [UserService],
})
export class UserModule {}
