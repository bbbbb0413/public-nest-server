import { User } from '../../libs/auth/src/user/domain/model/user';

export const createUserFixture = (): User => {
  return User.restore({
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    password: '$2b$10$hashedpassword',
    activatedAt: new Date('2024-01-01'),
  });
};
