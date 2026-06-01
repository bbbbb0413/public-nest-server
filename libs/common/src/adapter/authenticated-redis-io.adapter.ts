import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import * as jwt from 'jsonwebtoken';
import { NextFunction } from 'express';
import { CHAT_SOCKET_TTL } from '@libs/common/constants/chat.constants';

class CustomError {
  code: number;
  details: string;
  message: string;

  constructor(message: string, code: number, details: string) {
    this.code = code;
    this.details = details;
    this.message = message;
  }
}

export class AuthenticatedRedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private redisClient: any;

  async connectToRedis(): Promise<void> {
    const pubClient = createClient({
      url: `redis://${process.env.REDIS_DB_HOST}:${process.env.REDIS_DB_PORT}`,
      database: Number(process.env.CHAT_REDIS_DB_NUMBER),
    });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.redisClient = pubClient;
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  private handleJWTError(next: (err?: Error) => void): void {
    const error = new CustomError(
      'Invalid token',
      401,
      'The token is invalid or expired',
    );
    const message = JSON.stringify(error);
    next(new Error(message));
  }

  private verifyToken(socket: Socket, next: (err?: Error) => void): void {
    let token =
      socket.handshake.auth.token || socket.handshake.headers?.authorization;

    if (!token) {
      this.handleJWTError(next);
    } else {
      try {
        if (token.startsWith('Bearer ')) {
          token = token.substring(7);
        }
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET) as any;
        socket.data.user = decoded;
        if (decoded && decoded.id) {
          socket.data.userId = String(decoded.id);
        }
        if (socket.handshake.query?.userId) {
          this.redisClient.expire(socket.handshake.query.userId as string, CHAT_SOCKET_TTL);
        }

        next();
      } catch (err: any) {
        socket.disconnect(true);
        this.handleJWTError(next);
      }
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    // Redis Pub/Sub 적용
    server.adapter(this.adapterConstructor);

    const self = this;
    const originalOf = server.of.bind(server);
    server.of = function (name: any, fn: any) {
      const namespace = originalOf(name, fn);
      if (!namespace._jwtMiddlewareRegistered) {
        namespace._jwtMiddlewareRegistered = true;
        namespace.use((socket: Socket, next: any) => {
          self.verifyToken(socket, next);
        });
        namespace.on('connection', (socket: Socket) => {
          socket.use((_, next) => self.verifyToken(socket, next));
        });
      }
      return namespace;
    };

    // JWT 인증 적용
    server.use((socket: Socket, next: NextFunction) => {
      this.verifyToken(socket, next);
    });

    // 통신마다 JWT 인증 및 TTL 갱신
    server.on('connection', (socket: Socket) => {
      socket.use((_, next) => this.verifyToken(socket, next));
    });

    return server;
  }
}
