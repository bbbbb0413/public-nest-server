import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { IUsersRepository } from './domain/repository/users.repository';
import { createUsersDomainRepositoryMock } from '../../../../test-support/mocks/users-domain-repository.mock';
import { createBullQueueMock } from '../../../../test-support/mocks/bull-queue.mock';
import { getQueueToken } from '@nestjs/bull';
import { ServerErrorException } from '@libs/common/exception/server-error.exception';
import { createUserDomainFixture } from '../../../../test-support/fixtures/user-domain.fixture';
import {
  PageOptionsDto,
  Order,
} from '@libs/common/pagination/dto/page-options.dto';

describe('UserService', () => {
  let service: UserService;
  let usersRepository: ReturnType<typeof createUsersDomainRepositoryMock>;
  let queue: ReturnType<typeof createBullQueueMock>;

  beforeEach(async () => {
    usersRepository = createUsersDomainRepositoryMock();
    queue = createBullQueueMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: IUsersRepository, useValue: usersRepository },
        { provide: getQueueToken('mail'), useValue: queue },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('isDuplicated', () => {
    it('이미 가입된 이메일이면 ServerErrorException을 던진다', async () => {
      usersRepository.countByEmail.mockResolvedValue(1);
      await expect(
        service.isDuplicated({ email: 't@e.com', password: 'pw', name: 'n' }),
      ).rejects.toThrow(ServerErrorException);
    });

    it('중복 없으면 정상 통과한다', async () => {
      usersRepository.countByEmail.mockResolvedValue(0);
      await expect(
        service.isDuplicated({ email: 't@e.com', password: 'pw', name: 'n' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('isPasswordComplexity', () => {
    it('복잡도 미달 비밀번호면 ServerErrorException을 던진다', () => {
      expect(() =>
        service.isPasswordComplexity({
          email: 't@e.com',
          password: 'pw',
          name: 'n',
        }),
      ).toThrow(ServerErrorException);
    });

    it('유효한 비밀번호면 통과한다', () => {
      expect(() =>
        service.isPasswordComplexity({
          email: 't@e.com',
          password: 'Test@12345!',
          name: 'n',
        }),
      ).not.toThrow();
    });
  });

  describe('signup', () => {
    it('이름이 공백이면 ServerErrorException을 던진다', async () => {
      await expect(
        service.signup({ email: 't@e.com', password: 'pw', name: '   ' }),
      ).rejects.toThrow(ServerErrorException);
    });

    it('정상 가입 시 UserOutDto를 반환하고 메일 큐에 등록한다', async () => {
      const mockUser = createUserDomainFixture();
      usersRepository.countByEmail.mockResolvedValue(0);
      usersRepository.persist.mockResolvedValue(mockUser);

      const result = await service.signup({
        email: 'test@example.com',
        password: 'Test@12345!',
        name: 'Test User',
      });
      expect(result.email).toBe(mockUser.email.getValue());
      expect(queue.add).toHaveBeenCalledWith('send-mail', {
        userId: mockUser.id,
      });
    });
  });

  describe('changePassword', () => {
    it('비밀번호 복잡도 미달 시 ServerErrorException을 던진다', async () => {
      usersRepository.findByEmail.mockResolvedValue(createUserDomainFixture());
      await expect(
        service.changePassword(
          { email: 't@e.com', password: 'pw', name: 'n' },
          't@e.com',
        ),
      ).rejects.toThrow(ServerErrorException);
    });

    it('다른 사용자 비밀번호 변경 시 ServerErrorException을 던진다', async () => {
      usersRepository.findByEmail.mockResolvedValue(createUserDomainFixture());
      await expect(
        service.changePassword(
          { email: 't@e.com', password: 'Test@12345!', name: 'n' },
          'other@e.com',
        ),
      ).rejects.toThrow(ServerErrorException);
    });

    it('본인 비밀번호 변경 성공 시 updatePasswordByEmail을 호출한다', async () => {
      usersRepository.findByEmail.mockResolvedValue(createUserDomainFixture());
      usersRepository.updatePasswordByEmail.mockResolvedValue(undefined);

      await service.changePassword(
        { email: 't@e.com', password: 'Test@12345!', name: 'n' },
        't@e.com',
      );
      expect(usersRepository.updatePasswordByEmail).toHaveBeenCalledWith(
        't@e.com',
        expect.any(String),
      );
    });
  });

  describe('signIn', () => {
    it('비밀번호 불일치 시 ServerErrorException을 던진다', async () => {
      const mockUser = createUserDomainFixture();
      jest.spyOn(mockUser, 'checkPassword').mockResolvedValue(false);
      usersRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(service.signIn('t@e.com', 'wrong-pw')).rejects.toThrow(
        ServerErrorException,
      );
    });

    it('미활성 계정 로그인 시 ServerErrorException을 던진다', async () => {
      const mockUser = createUserDomainFixture({ activatedAt: null });
      jest.spyOn(mockUser, 'checkPassword').mockResolvedValue(true);
      usersRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(service.signIn('t@e.com', 'pw')).rejects.toThrow(
        ServerErrorException,
      );
    });

    it('정상 로그인 시 UserOutDto를 반환한다', async () => {
      const mockUser = createUserDomainFixture();
      jest.spyOn(mockUser, 'checkPassword').mockResolvedValue(true);
      usersRepository.findByEmail.mockResolvedValue(mockUser);

      const result = await service.signIn('t@e.com', 'pw');
      expect(result.email).toBe(mockUser.email.getValue());
    });
  });

  describe('activate', () => {
    it('없는 ID 활성화 시 ServerErrorException을 던진다', async () => {
      usersRepository.activateById.mockResolvedValue(0);
      await expect(service.activate(999)).rejects.toThrow(ServerErrorException);
    });

    it('활성화 성공 시 UserOutDto를 반환한다', async () => {
      const mockUser = createUserDomainFixture();
      usersRepository.activateById.mockResolvedValue(1);
      usersRepository.findUserById.mockResolvedValue(mockUser);

      const result = await service.activate(1);
      expect(result.email).toBe(mockUser.email.getValue());
    });
  });

  describe('deactivate', () => {
    it('없는 ID 비활성화 시 ServerErrorException을 던진다', async () => {
      usersRepository.deactivateById.mockResolvedValue(0);
      await expect(service.deactivate(999)).rejects.toThrow(
        ServerErrorException,
      );
    });

    it('비활성화 성공 시 UserOutDto를 반환한다', async () => {
      const mockUser = createUserDomainFixture({ activatedAt: null });
      usersRepository.deactivateById.mockResolvedValue(1);
      usersRepository.findUserById.mockResolvedValue(mockUser);

      const result = await service.deactivate(1);
      expect(result.email).toBe(mockUser.email.getValue());
    });
  });

  describe('updateRole', () => {
    it('미구현 상태이므로 항상 ServerErrorException을 던진다', () => {
      expect(() => service.updateRole({ userId: 1 })).toThrow(
        ServerErrorException,
      );
    });
  });

  describe('findAll', () => {
    it('페이지네이션 목록을 반환한다', async () => {
      const mockUser = createUserDomainFixture();
      usersRepository.findAllAndCount.mockResolvedValue([[mockUser], 1]);

      const pageOptions = {
        order: Order.ASC,
        page: 1,
        take: 10,
      } as PageOptionsDto;
      const [list, meta] = await service.findAll(pageOptions);
      expect(list[0].email).toBe(mockUser.email.getValue());
      expect(meta.itemCount).toBe(1);
    });
  });

  describe('findById', () => {
    it('없는 ID 조회 시 ServerErrorException을 던진다', async () => {
      usersRepository.findUserById.mockResolvedValue(null);
      await expect(service.findById(999)).rejects.toThrow(ServerErrorException);
    });

    it('정상 ID 조회 시 UserOutDto를 반환한다', async () => {
      const mockUser = createUserDomainFixture();
      usersRepository.findUserById.mockResolvedValue(mockUser);
      const result = await service.findById(1);
      expect(result.email).toBe(mockUser.email.getValue());
    });
  });

  describe('findByEmail', () => {
    it('없는 이메일 조회 시 ServerErrorException을 던진다', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);
      await expect(service.findByEmail('none@e.com')).rejects.toThrow(
        ServerErrorException,
      );
    });

    it('정상 이메일 조회 시 UserOutDto를 반환한다', async () => {
      const mockUser = createUserDomainFixture();
      usersRepository.findByEmail.mockResolvedValue(mockUser);
      const result = await service.findByEmail('test@example.com');
      expect(result.email).toBe(mockUser.email.getValue());
    });
  });

  describe('removeAdminUser', () => {
    it('없는 유저 삭제 시 ServerErrorException을 던진다', async () => {
      usersRepository.findUserById.mockResolvedValue(null);
      await expect(service.removeAdminUser(999, 'executor')).rejects.toThrow(
        ServerErrorException,
      );
    });

    it('정상 삭제에 성공한다', async () => {
      const mockUser = createUserDomainFixture();
      usersRepository.findUserById.mockResolvedValue(mockUser);
      usersRepository.softDeleteById.mockResolvedValue(undefined);

      await expect(
        service.removeAdminUser(1, 'executor'),
      ).resolves.toBeUndefined();
      expect(usersRepository.softDeleteById).toHaveBeenCalledWith(1);
    });
  });
});
