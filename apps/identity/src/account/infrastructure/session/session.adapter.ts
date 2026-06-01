import { Injectable } from '@nestjs/common';
import { SessionRepository } from '@libs/auth/auth/infrastructure/session/session.repository';
import { ISessionPort, SessionData } from '../../domain/port/session.port';
import { Session } from '@libs/shared-kernel';

@Injectable()
export class SessionAdapter implements ISessionPort {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async setSession(
    userId: number,
    data: SessionData,
    ttl: number,
  ): Promise<void> {
    const session = Session.create({
      uuid: data.uuid,
      nickName: data.nickName,
    });
    await this.sessionRepository.setSession(userId, session, ttl);
  }
}
