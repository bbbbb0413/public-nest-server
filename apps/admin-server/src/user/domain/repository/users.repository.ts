import { User } from '../model/user';

export interface IUsersRepository {
  findUserById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  countByEmail(email: string): Promise<number>;
  findAllAndCount(
    take: number,
    skip: number,
    orderBy: 'ASC' | 'DESC',
  ): Promise<[User[], number]>;
  persist(user: User): Promise<User>;
  updatePasswordByEmail(email: string, hashedPassword: string): Promise<void>;
  activateById(id: number): Promise<number>;
  deactivateById(id: number): Promise<number>;
  softDeleteById(id: number): Promise<void>;
}

export const IUsersRepository = Symbol('IUsersRepository');
