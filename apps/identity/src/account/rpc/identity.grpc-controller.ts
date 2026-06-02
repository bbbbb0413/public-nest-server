import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { Metadata, status } from '@grpc/grpc-js';
import { IdentityServiceController, LoginRequest, LoginResponse, GetGameAccountRequest, GameAccountReply, SendMailRequest, SendMailResponse } from '@libs/rpc';
import { LoginUseCase } from '../application/login.use-case';
import { IGameAccountRepository, GameAccountRepository } from '../domain/repository/game-account.repository';
import { IMailRepository } from '../../mail/domain/repository/mail.repository';
import { IdentityGrpcMapper } from './identity.grpc-mapper';

@Controller()
export class IdentityGrpcController implements IdentityServiceController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    @Inject(GameAccountRepository)
    private readonly gameAccountRepository: IGameAccountRepository,
    @Inject(IMailRepository)
    private readonly mailRepository: IMailRepository,
  ) {}

  @GrpcMethod('IdentityService', 'Login')
  async login(
    request: LoginRequest,
    _metadata: Metadata,
  ): Promise<LoginResponse> {
    const command = IdentityGrpcMapper.toLoginCommand(request);
    const account = await this.loginUseCase.execute(command);
    return IdentityGrpcMapper.toLoginResponse(account);
  }

  @GrpcMethod('IdentityService', 'GetGameAccount')
  async getGameAccount(
    request: GetGameAccountRequest,
    _metadata: Metadata,
  ): Promise<GameAccountReply> {
    const account = await this.gameAccountRepository.findByUuid(request.uuid);
    if (!account) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Game account with UUID ${request.uuid} not found`,
      });
    }
    return IdentityGrpcMapper.toGameAccountReply(account);
  }

  @GrpcMethod('IdentityService', 'SendMail')
  async sendMail(
    request: SendMailRequest,
    _metadata: Metadata,
  ): Promise<SendMailResponse> {
    const mail = IdentityGrpcMapper.toMailModel(request);
    const savedMail = await this.mailRepository.persist(mail);
    return IdentityGrpcMapper.toSendMailResponse(savedMail);
  }
}
