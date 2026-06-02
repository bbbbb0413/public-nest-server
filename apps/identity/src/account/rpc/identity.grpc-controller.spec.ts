import { Test, TestingModule } from '@nestjs/testing';
import { IdentityGrpcController } from './identity.grpc-controller';
import { LoginUseCase } from '../application/login.use-case';
import { IGameAccountRepository, GameAccountRepository } from '../domain/repository/game-account.repository';
import { IMailRepository } from '../../mail/domain/repository/mail.repository';
import { GameAccount } from '../domain/model/game-account';
import { Mail } from '../../mail/domain/model/mail';
import { Metadata } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { LoginRequest, LoginResponse, GetGameAccountRequest, GameAccountReply, SendMailRequest, SendMailResponse } from '@libs/rpc';

const mockLoginUseCase = () => ({
  execute: jest.fn(),
});

const mockGameAccountRepository = () => ({
  findByUuid: jest.fn(),
  persist: jest.fn(),
});

const mockMailRepository = () => ({
  persist: jest.fn(),
});

describe('IdentityGrpcController', () => {
  let controller: IdentityGrpcController;
  let loginUseCase: ReturnType<typeof mockLoginUseCase>;
  let gameAccountRepository: ReturnType<typeof mockGameAccountRepository>;
  let mailRepository: ReturnType<typeof mockMailRepository>;

  beforeEach(async () => {
    loginUseCase = mockLoginUseCase();
    gameAccountRepository = mockGameAccountRepository();
    mailRepository = mockMailRepository();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IdentityGrpcController],
      providers: [
        { provide: LoginUseCase, useValue: loginUseCase },
        { provide: GameAccountRepository, useValue: gameAccountRepository },
        { provide: IMailRepository, useValue: mailRepository },
      ],
    }).compile();

    controller = module.get<IdentityGrpcController>(IdentityGrpcController);
  });

  describe('login', () => {
    it('gRPC 로그인 요청을 받아 UseCase를 실행하고 결과를 반환해야 한다', async () => {
      const mockAccount = GameAccount.restore({ id: 10, uuid: 'user-uuid-10', nickName: 'Gamer10' });
      loginUseCase.execute.mockResolvedValue(mockAccount);

      const request: LoginRequest = { uuid: 'user-uuid-10' };
      const metadata = new Metadata();

      const reply = (await controller.login(request, metadata)) as LoginResponse;

      expect(loginUseCase.execute).toHaveBeenCalled();
      expect(reply.id).toBe(10);
      expect(reply.uuid).toBe('user-uuid-10');
      expect(reply.nickName).toBe('Gamer10');
    });
  });

  describe('getGameAccount', () => {
    it('계정이 존재하면 gRPC GameAccountReply를 반환해야 한다', async () => {
      const mockAccount = GameAccount.restore({ id: 10, uuid: 'user-uuid-10', nickName: 'Gamer10' });
      gameAccountRepository.findByUuid.mockResolvedValue(mockAccount);

      const request: GetGameAccountRequest = { uuid: 'user-uuid-10' };
      const metadata = new Metadata();

      const reply = (await controller.getGameAccount(request, metadata)) as GameAccountReply;

      expect(gameAccountRepository.findByUuid).toHaveBeenCalledWith('user-uuid-10');
      expect(reply.id).toBe(10);
      expect(reply.nickName).toBe('Gamer10');
    });

    it('계정이 존재하지 않으면 RpcException(NOT_FOUND)을 발생시켜야 한다', async () => {
      gameAccountRepository.findByUuid.mockResolvedValue(null);

      const request: GetGameAccountRequest = { uuid: 'user-uuid-999' };
      const metadata = new Metadata();

      await expect(controller.getGameAccount(request, metadata)).rejects.toThrow(RpcException);
    });
  });

  describe('sendMail', () => {
    it('메일 발송 요청을 받아 DB에 저장하고 결과를 반환해야 한다', async () => {
      const mockMail = Mail.restore({ id: 50, userId: 10, type: 0, contents: 'Title: Body' });
      mailRepository.persist.mockResolvedValue(mockMail);

      const request: SendMailRequest = {
        accountId: 10,
        title: 'Title',
        body: 'Body',
      };
      const metadata = new Metadata();

      const reply = (await controller.sendMail(request, metadata)) as SendMailResponse;

      expect(mailRepository.persist).toHaveBeenCalled();
      expect(reply.mailId).toBe(50);
      expect(reply.delivered).toBe(true);
    });
  });
});
