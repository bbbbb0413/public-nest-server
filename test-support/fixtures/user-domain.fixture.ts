import { User } from '../../libs/auth/src/user/domain/model/user';

export const createUserDomainFixture = (
  overrides: Partial<{
    id: number;
    name: string;
    email: string;
    activatedAt: Date | null;
  }> = {},
): User => {
  return User.restore({
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Test User',
    email: overrides.email ?? 'test@example.com',
    password: '$2b$10$hashedpassword',
    activatedAt:
      'activatedAt' in overrides
        ? overrides.activatedAt
        : new Date('2024-01-01'),
  });
};
