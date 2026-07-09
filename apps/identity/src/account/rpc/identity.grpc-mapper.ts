import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  GameAccountReply,
  SendMailRequest,
  SendMailResponse,
} from '@libs/rpc';
import { LoginCommand } from '../application/command/login.command';
import { RegisterCommand } from '../application/command/register.command';
import { GameAccount } from '../domain/model/game-account';
import { Mail } from '../../mail/domain/model/mail';

export class IdentityGrpcMapper {
  static toLoginCommand(request: LoginRequest): LoginCommand {
    return new LoginCommand(request.uuid);
  }

  static toRegisterCommand(request: RegisterRequest): RegisterCommand {
    return new RegisterCommand(request.nickName);
  }

  static toRegisterResponse(account: GameAccount): RegisterResponse {
    return {
      id: account.id,
      uuid: account.uuid.getValue(),
      nickName: account.nickName.getValue(),
    };
  }

  static toLoginResponse(account: GameAccount): LoginResponse {
    return {
      id: account.id,
      uuid: account.uuid.getValue(),
      nickName: account.nickName.getValue(),
    };
  }

  static toGameAccountReply(account: GameAccount): GameAccountReply {
    return {
      id: account.id,
      uuid: account.uuid.getValue(),
      nickName: account.nickName.getValue(),
    };
  }

  static toMailModel(request: SendMailRequest): Mail {
    return Mail.create({
      userId: request.accountId,
      type: 0,
      contents: `${request.title}: ${request.body}`,
    });
  }

  static toSendMailResponse(mail: Mail): SendMailResponse {
    return {
      mailId: mail.id,
      delivered: true,
    };
  }
}
