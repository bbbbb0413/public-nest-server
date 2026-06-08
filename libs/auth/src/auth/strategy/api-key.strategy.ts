import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import Strategy from 'passport-headerapikey';
import { AuthService } from '../auth.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'apiKey') {
  constructor(private authService: AuthService) {
    super({ header: 'X-API-KEY', prefix: '' }, true);
  }

  validate(apiKey: string): boolean {
    if (this.authService.validateApiKey(apiKey)) {
      return true;
    }
    throw new UnauthorizedException();
  }
}
