import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '@libs/common/constants/jwt.constants';
import { Session } from '@libs/shared-kernel';
import { ISessionRepository } from './port/session-repository.port';

@Injectable()
export class AuthService {
  private apiKeys: string[] = [
    process.env.AUTH_KEY,
    process.env.DSP_AUTH_KEY,
  ].filter(Boolean);

  constructor(
    private readonly jwtService: JwtService,
    @Inject(ISessionRepository)
    private readonly sessionRepository: ISessionRepository,
  ) {}

  validateApiKey(apiKey: string): string {
    return this.apiKeys.find((key) => key === apiKey);
  }

  validateUser(payload: JwtPayload): boolean {
    return !!payload.activatedAt;
  }

  makeAuthToken(payload: any): string {
    return this.jwtService.sign(payload);
  }

  async validateSession(id: string, sessionId: string): Promise<Session> {
    const session = await this.sessionRepository.getSession(id);

    if (!session) {
      throw new UnauthorizedException();
    } else if (session.id !== sessionId) {
      throw new UnauthorizedException();
    }

    return session;
  }
}
