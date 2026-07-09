import { Test, TestingModule } from '@nestjs/testing';
import { RegisterUseCase } from './register.use-case';
import { RegisterCommand } from './command/register.command';
import { GameAccountRepository } from '../domain/repository/game-account.repository';
import { SessionPort } from '../domain/port/session.port';
import { GameAccount } from '../domain/model/game-account';

const mockGameAccountRepository = () => ({
  persist: jest.fn(),
});

const mockSessionPort = () => ({
  setSession: jest.fn(),
});

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;
  let gameAccountRepo: ReturnType<typeof mockGameAccountRepository>;
  let sessionPort: ReturnType<typeof mockSessionPort>;

  beforeEach(async () => {
    gameAccountRepo = mockGameAccountRepository();
    sessionPort = mockSessionPort();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterUseCase,
        { provide: GameAccountRepository, useValue: gameAccountRepo },
        { provide: SessionPort, useValue: sessionPort },
      ],
    }).compile();

    useCase = module.get<RegisterUseCase>(RegisterUseCase);
  });

  it('닉네임 없이 등록하면 빈 닉네임으로 계정을 생성한다', async () => {
    const saved = GameAccount.restore({
      id: 1,
      uuid: 'generated-uuid',
      nickName: '',
    });
    gameAccountRepo.persist.mockResolvedValue(saved);
    sessionPort.setSession.mockResolvedValue(undefined);

    const result = await useCase.execute(new RegisterCommand());

    expect(gameAccountRepo.persist).toHaveBeenCalled();
    expect(sessionPort.setSession).toHaveBeenCalledWith(
      saved.id,
      expect.objectContaining({ uuid: expect.any(String) }),
      3600,
    );
    expect(result.id).toBe(1);
  });

  it('닉네임을 전달하면 해당 닉네임으로 계정을 생성한다', async () => {
    const saved = GameAccount.restore({
      id: 2,
      uuid: 'generated-uuid',
      nickName: '테스터',
    });
    gameAccountRepo.persist.mockResolvedValue(saved);
    sessionPort.setSession.mockResolvedValue(undefined);

    const result = await useCase.execute(new RegisterCommand('테스터'));

    expect(gameAccountRepo.persist).toHaveBeenCalled();
    expect(result.nickName.getValue()).toBe('테스터');
  });

  it('실행할 때마다 고유한 UUID를 생성한다', async () => {
    const uuids: string[] = [];

    gameAccountRepo.persist.mockImplementation(async (account: GameAccount) => {
      uuids.push(account.uuid.getValue());
      return GameAccount.restore({
        id: 1,
        uuid: account.uuid.getValue(),
        nickName: '',
      });
    });
    sessionPort.setSession.mockResolvedValue(undefined);

    await useCase.execute(new RegisterCommand());
    await useCase.execute(new RegisterCommand());

    expect(uuids[0]).not.toBe(uuids[1]);
  });
});
