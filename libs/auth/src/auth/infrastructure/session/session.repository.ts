import { Injectable } from '@nestjs/common';
import { AbstractRedisRepository } from '@libs/common/databases/redis/abstract-redis.repository';
import { Session } from '@libs/shared-kernel';
import { ISessionRepository } from '../../port/session-repository.port';

@Injectable()
export class SessionRepository
  extends AbstractRedisRepository
  implements ISessionRepository
{
  protected readonly dbNumber = 0;

  constructor() {
    super();
    this.createRedisClient();
  }

  async getSession(id: string): Promise<Session> {
    return JSON.parse(await this.redis.get(id)) as Session;
  }

  async setSession(id: number, session: Session, ttl = -1): Promise<void> {
    await this.redis.set(id.toString(), JSON.stringify(session), 'EX', ttl);
  }
}
