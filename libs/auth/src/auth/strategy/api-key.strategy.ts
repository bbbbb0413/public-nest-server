import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import Strategy from 'passport-headerapikey';
import { AuthService } from '../auth.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'apiKey') {
  constructor(private authService: AuthService) {
    super(
      { header: 'X-API-KEY', prefix: '' },
      true,
      (apiKey: string, done: (error: Error, data: any) => unknown) => {
        return this.validate(apiKey, done);
      },
    );
  }

  validate(apiKey: string, done: (error: Error, data: any) => unknown): void {
    if (this.authService.validateApiKey(apiKey)) {
      done(null, true);
    }
    done(new UnauthorizedException(), null);
  }
}
