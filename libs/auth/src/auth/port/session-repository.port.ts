import { Session } from '@libs/shared-kernel';

export interface ISessionRepository {
  getSession(id: string): Promise<Session | null>;
  setSession(id: number, session: Session, ttl?: number): Promise<void>;
}

export const ISessionRepository = Symbol('ISessionRepository');
