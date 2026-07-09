import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  private readonly adminApiKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.adminApiKey = config.get<string>('ADMIN_API_KEY');
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.adminApiKey) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers['x-admin-key'];

    if (key !== this.adminApiKey) {
      throw new UnauthorizedException('Invalid admin API key');
    }

    return true;
  }
}
