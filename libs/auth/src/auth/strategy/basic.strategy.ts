import { BasicStrategy as Strategy } from 'passport-http';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthService } from '../auth.service';
import { Session } from '@libs/shared-kernel';

@Injectable()
export class BasicStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'id',
      passwordField: 'sessionId',
    });
  }

  public async validate(id: string, sessionId: string): Promise<Session> {
    return await this.authService.validateSession(id, sessionId);
  }
}
