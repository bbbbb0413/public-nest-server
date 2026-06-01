import { Module } from '@nestjs/common';
import { TypeOrmExModule } from '@libs/common/databases/typeorm/typeorm-ex.module';
import GameDatabaseConfig from '@libs/common/config/database/game-database.config';
import { SessionModule } from '@libs/auth/auth/infrastructure/session/session.module';
import { LoginController } from './presentation/login.controller';
import { LoginUseCase } from './application/login.use-case';
import { GameAccountRepository } from './domain/repository/game-account.repository';
import { SessionPort } from './domain/port/session.port';
import { GameAccountRepositoryImpl } from './infrastructure/persistence/game-account.repository-impl';
import { SessionAdapter } from './infrastructure/session/session.adapter';

@Module({
  imports: [
    TypeOrmExModule.forFeatures(
      [GameAccountRepositoryImpl],
      [GameDatabaseConfig().name],
    ),
    SessionModule,
  ],
  controllers: [LoginController],
  providers: [
    LoginUseCase,
    { provide: GameAccountRepository, useClass: GameAccountRepositoryImpl },
    { provide: SessionPort, useClass: SessionAdapter },
  ],
})
export class AccountModule {}
