export interface Session {
  id: string;
  uuid: string;
  nickName: string;
  gameDbId: number;
  database: string;
}

export type Empty = Record<never, never>;
