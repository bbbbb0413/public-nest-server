export interface SessionData {
  uuid: string;
  nickName: string;
}

export interface ISessionPort {
  setSession(userId: number, data: SessionData, ttl: number): Promise<void>;
}

export const SessionPort = Symbol('SessionPort');
