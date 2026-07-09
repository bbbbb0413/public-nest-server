import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RegisterCommand } from './command/register.command';
import { GameAccount } from '../domain/model/game-account';
import {
  GameAccountRepository,
  IGameAccountRepository,
} from '../domain/repository/game-account.repository';
import { ISessionPort, SessionPort } from '../domain/port/session.port';

@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject(GameAccountRepository)
    private readonly gameAccountRepository: IGameAccountRepository,
    @Inject(SessionPort)
    private readonly sessionPort: ISessionPort,
  ) {}

  async execute(command: RegisterCommand): Promise<GameAccount> {
    const uuid = randomUUID();
    const account = await this.gameAccountRepository.persist(
      GameAccount.create({ uuid, nickName: command.nickName }),
    );

    await this.sessionPort.setSession(
      account.id,
      { uuid: account.uuid.getValue(), nickName: account.nickName.getValue() },
      3600,
    );

    return account;
  }
}
