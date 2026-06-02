import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Session } from '@libs/shared-kernel';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class GatewayAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    const apiKeyHeader = request.headers['x-api-key'];

    let guard: CanActivate;
    let authType: 'jwt' | 'basic' | 'apikey';

    if (apiKeyHeader) {
      guard = new (AuthGuard('apiKey'))();
      authType = 'apikey';
    } else if (authHeader) {
      if (authHeader.toLowerCase().startsWith('bearer ')) {
        guard = new (AuthGuard('jwt'))();
        authType = 'jwt';
      } else if (authHeader.toLowerCase().startsWith('basic ')) {
        guard = new (AuthGuard('basic'))();
        authType = 'basic';
      } else {
        throw new UnauthorizedException('Unsupported authorization scheme');
      }
    } else {
      throw new UnauthorizedException('Authentication credentials missing');
    }

    try {
      const result = await guard.canActivate(context);
      if (!result) {
        throw new UnauthorizedException();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Authentication failed';
      throw new UnauthorizedException(msg);
    }

    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('User session could not be established');
    }

    if (authType === 'basic') {
      request.session = user as Session;
    } else if (authType === 'jwt') {
      request.session = Session.create({
        uuid: String(user.id),
        nickName: user.name,
        gameDbId: user.id,
        database: 'game_db',
      });
    } else if (authType === 'apikey') {
      request.session = Session.create({
        uuid: 'api-key-user',
        nickName: 'ApiKeySystem',
        gameDbId: 0,
        database: 'game_db',
      });
    }

    return true;
  }
}
