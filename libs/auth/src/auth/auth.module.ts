import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ContextProvider } from '@libs/common/provider/context.provider';
import { PassportModule } from '@nestjs/passport';
import { ApiKeyStrategy } from './strategy/api-key.strategy';
import { BasicStrategy } from './strategy/basic.strategy';
import { JwtStrategy } from './strategy/jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { JWT_OPTIONS } from '@libs/common/constants/jwt.constants';
import { UserService } from '../user/user.service';
import { AuthController } from './auth.controller';
import { UserController } from '../user/user.controller';
import { SessionModule } from './infrastructure/session/session.module';
import { BullModule } from '@nestjs/bull';
import { TypeOrmExModule } from '@libs/common/databases/typeorm/typeorm-ex.module';
import PersonalDatabaseConfig from '@libs/common/config/database/personal-database.config';
import { UsersRepositoryImpl } from '../user/infrastructure/persistence/users.repository-impl';
import { IUsersRepository } from '../user/domain/repository/users.repository';
import { ISessionRepository } from './port/session-repository.port';
import { SessionRepository } from './infrastructure/session/session.repository';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.ACCESS_TOKEN_SECRET,
      signOptions: { expiresIn: JWT_OPTIONS.expiresIn },
    }),
    TypeOrmExModule.forFeatures(
      [UsersRepositoryImpl],
      [PersonalDatabaseConfig().name],
    ),
    SessionModule,
    BullModule.registerQueue({ name: 'test' }),
  ],
  controllers: [AuthController, UserController],
  providers: [
    BasicStrategy,
    ApiKeyStrategy,
    JwtStrategy,
    ContextProvider,
    AuthService,
    UserService,
    { provide: IUsersRepository, useClass: UsersRepositoryImpl },
    { provide: ISessionRepository, useClass: SessionRepository },
  ],
  exports: [AuthService, UserService],
})
export class AuthModule {}
