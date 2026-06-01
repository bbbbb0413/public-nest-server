import { Inject, Injectable } from '@nestjs/common';
import { LoginCommand } from './command/login.command';
import { GameAccount } from '../domain/model/game-account';
import {
  GameAccountRepository,
  IGameAccountRepository,
} from '../domain/repository/game-account.repository';
import { ISessionPort, SessionPort } from '../domain/port/session.port';

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(GameAccountRepository)
    private readonly gameAccountRepository: IGameAccountRepository,
    @Inject(SessionPort)
    private readonly sessionPort: ISessionPort,
  ) {}

  async execute(command: LoginCommand): Promise<GameAccount> {
    const { uuid } = command;

    const account =
      (await this.gameAccountRepository.findByUuid(uuid)) ??
      (await this.gameAccountRepository.persist(GameAccount.create({ uuid })));

    await this.sessionPort.setSession(
      account.id,
      { uuid: account.uuid.getValue(), nickName: account.nickName.getValue() },
      3600,
    );

    return account;
  }
}
