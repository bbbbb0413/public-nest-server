import { IUsersRepository } from '../../libs/auth/src/user/domain/repository/users.repository';

export const createUsersDomainRepositoryMock =
  (): jest.Mocked<IUsersRepository> =>
    ({
      findUserById: jest.fn(),
      findByEmail: jest.fn(),
      countByEmail: jest.fn(),
      findAllAndCount: jest.fn(),
      persist: jest.fn(),
      updatePasswordByEmail: jest.fn(),
      activateById: jest.fn(),
      deactivateById: jest.fn(),
      softDeleteById: jest.fn(),
    } as any);
