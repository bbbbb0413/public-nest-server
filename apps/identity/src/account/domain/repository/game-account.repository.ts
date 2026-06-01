import { GameAccount } from '../model/game-account';

export interface IGameAccountRepository {
  findByUuid(uuid: string): Promise<GameAccount | null>;
  persist(account: GameAccount): Promise<GameAccount>;
}

export const GameAccountRepository = Symbol('GameAccountRepository');
