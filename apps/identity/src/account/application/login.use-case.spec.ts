import { Test, TestingModule } from '@nestjs/testing';
import { LoginUseCase } from './login.use-case';
import { LoginCommand } from './command/login.command';
import { GameAccountRepository } from '../domain/repository/game-account.repository';
import { SessionPort } from '../domain/port/session.port';
import { GameAccount } from '../domain/model/game-account';

const mockGameAccountRepository = () => ({
  findByUuid: jest.fn(),
  persist: jest.fn(),
});

const mockSessionPort = () => ({
  setSession: jest.fn(),
});

const buildRestoredAccount = (
  overrides: Partial<{ id: number; uuid: string; nickName: string }> = {},
): GameAccount =>
  GameAccount.restore({
    id: 1,
    uuid: 'mock-uuid',
    nickName: 'Mock',
    ...overrides,
  });

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let gameAccountRepo: ReturnType<typeof mockGameAccountRepository>;
  let sessionPort: ReturnType<typeof mockSessionPort>;

  beforeEach(async () => {
    gameAccountRepo = mockGameAccountRepository();
    sessionPort = mockSessionPort();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginUseCase,
        { provide: GameAccountRepository, useValue: gameAccountRepo },
        { provide: SessionPort, useValue: sessionPort },
      ],
    }).compile();

    useCase = module.get<LoginUseCase>(LoginUseCase);
  });

  it('기존 uuid면 기존 계정을 조회하고 세션을 설정한 뒤 반환한다', async () => {
    const account = buildRestoredAccount({ uuid: 'existing-uuid' });
    gameAccountRepo.findByUuid.mockResolvedValue(account);
    sessionPort.setSession.mockResolvedValue(undefined);

    const result = await useCase.execute(new LoginCommand('existing-uuid'));

    expect(result.uuid.getValue()).toBe('existing-uuid');
    expect(gameAccountRepo.findByUuid).toHaveBeenCalledWith('existing-uuid');
    expect(gameAccountRepo.persist).not.toHaveBeenCalled();
    expect(sessionPort.setSession).toHaveBeenCalledWith(
      account.id,
      expect.objectContaining({ uuid: 'existing-uuid' }),
      3600,
    );
  });

  it('신규 uuid면 새 계정을 생성하고 세션을 설정한 뒤 반환한다', async () => {
    const saved = buildRestoredAccount({ id: 2, uuid: 'new-uuid' });
    gameAccountRepo.findByUuid.mockResolvedValue(null);
    gameAccountRepo.persist.mockResolvedValue(saved);
    sessionPort.setSession.mockResolvedValue(undefined);

    const result = await useCase.execute(new LoginCommand('new-uuid'));

    expect(result.uuid.getValue()).toBe('new-uuid');
    expect(gameAccountRepo.persist).toHaveBeenCalled();
    expect(sessionPort.setSession).toHaveBeenCalledWith(
      saved.id,
      expect.objectContaining({ uuid: 'new-uuid' }),
      3600,
    );
  });
});
