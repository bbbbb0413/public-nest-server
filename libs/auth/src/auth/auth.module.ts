import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ContextProvider } from '@libs/common/provider/context.provider';
import { PassportModule } from '@nestjs/passport';
import { ApiKeyStrategy } from './strategy/api-key.strategy';
import { BasicStrategy } from './strategy/basic.strategy';
import { JwtStrategy } from './strategy/jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { JWT_OPTIONS } from '@libs/common/constants/jwt.constants';
import { SessionModule } from './infrastructure/session/session.module';
import { ISessionRepository } from './port/session-repository.port';
import { SessionRepository } from './infrastructure/session/session.repository';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.ACCESS_TOKEN_SECRET,
      signOptions: { expiresIn: JWT_OPTIONS.expiresIn },
    }),
    SessionModule,
  ],
  providers: [
    BasicStrategy,
    ApiKeyStrategy,
    JwtStrategy,
    ContextProvider,
    AuthService,
    { provide: ISessionRepository, useClass: SessionRepository },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
