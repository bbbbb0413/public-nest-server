import { v4 as uuidv4 } from 'uuid';

export class Session {
  id: string;
  uuid: string;
  nickName: string;
  gameDbId: number;
  database: string;

  static create(partial?: Partial<Session>): Session {
    const session = Object.assign(new this(), { ...partial });
    session.id = uuidv4();
    return session;
  }
}
