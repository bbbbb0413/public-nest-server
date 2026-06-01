# 테스트 계획서 — Identity & Payment 서버

## 1. 전략

| 항목 | 내용 |
|------|------|
| 단위 테스트 프레임워크 | Jest 28 + ts-jest |
| E2E 테스트 프레임워크 | Jest 28 + supertest |
| 커버리지 목표 | 80% 이상 |
| 실행 방식 | 단위: 앱별 독립 / E2E: 실제 DB·Redis 없이 모킹 |

### 모킹 원칙
- Repository 계층은 인터페이스 기반 `jest.fn()` 팩토리로 교체
- `JwtService`, `BullQueue`는 `overrideProvider`로 교체
- `JwtAuthGuard`는 E2E 테스트 시 `canActivate = () => true` 전략으로 우회
- 외부 서비스(Groq, Redis)는 단위 테스트에서 mocking

---

## 2. 생성할 파일 목록

### 2-1. Jest 설정

```
apps/identity/jest-unit.json
apps/identity/jest-e2e.json
apps/payment/jest-unit.json
apps/payment/jest-e2e.json
```

### 2-2. 공통 Mock 팩토리

```
test-support/
├── mocks/
│   ├── users-repository.mock.ts
│   ├── game-accounts-repository.mock.ts
│   ├── session-repository.mock.ts
│   ├── bull-queue.mock.ts
│   └── jwt-service.mock.ts
└── fixtures/
    ├── user.fixture.ts
    └── game-account.fixture.ts
```

### 2-3. Identity 단위 테스트

```
libs/auth/src/
├── auth/auth.service.spec.ts
└── user/user.service.spec.ts

apps/identity/src/
├── login/login.service.spec.ts
├── queue/queue.service.spec.ts
└── groq/groq.service.spec.ts
```

### 2-4. E2E 테스트

```
apps/identity/test/identity.e2e-spec.ts
apps/payment/test/payment.e2e-spec.ts
```

---

## 3. Jest 설정 파일

### `apps/identity/jest-unit.json`

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "../../",
  "testMatch": [
    "<rootDir>/apps/identity/src/**/*.spec.ts",
    "<rootDir>/libs/auth/src/**/*.spec.ts"
  ],
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "collectCoverageFrom": [
    "apps/identity/src/**/*.ts",
    "libs/auth/src/**/*.ts",
    "!**/*.module.ts",
    "!**/index.ts",
    "!**/*.dto.ts",
    "!**/*.entity.ts"
  ],
  "coverageDirectory": "coverage/identity",
  "testEnvironment": "node",
  "moduleNameMapper": {
    "^@libs/common(|/.*)$": "<rootDir>/libs/common/src/$1",
    "^@libs/dao(|/.*)$": "<rootDir>/libs/dao/src/$1",
    "^@libs/auth(|/.*)$": "<rootDir>/libs/auth/src/$1"
  }
}
```

### `apps/identity/jest-e2e.json`

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "../../",
  "testMatch": ["<rootDir>/apps/identity/test/**/*.e2e-spec.ts"],
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "testEnvironment": "node",
  "moduleNameMapper": {
    "^@libs/common(|/.*)$": "<rootDir>/libs/common/src/$1",
    "^@libs/dao(|/.*)$": "<rootDir>/libs/dao/src/$1",
    "^@libs/auth(|/.*)$": "<rootDir>/libs/auth/src/$1"
  }
}
```

### `apps/payment/jest-unit.json`

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "../../",
  "testMatch": [
    "<rootDir>/apps/payment/src/**/*.spec.ts",
    "<rootDir>/libs/auth/src/**/*.spec.ts"
  ],
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "collectCoverageFrom": [
    "apps/payment/src/**/*.ts",
    "libs/auth/src/**/*.ts",
    "!**/*.module.ts",
    "!**/index.ts",
    "!**/*.dto.ts",
    "!**/*.entity.ts"
  ],
  "coverageDirectory": "coverage/payment",
  "testEnvironment": "node",
  "moduleNameMapper": {
    "^@libs/common(|/.*)$": "<rootDir>/libs/common/src/$1",
    "^@libs/dao(|/.*)$": "<rootDir>/libs/dao/src/$1",
    "^@libs/auth(|/.*)$": "<rootDir>/libs/auth/src/$1"
  }
}
```

### `apps/payment/jest-e2e.json`

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "../../",
  "testMatch": ["<rootDir>/apps/payment/test/**/*.e2e-spec.ts"],
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "testEnvironment": "node",
  "moduleNameMapper": {
    "^@libs/common(|/.*)$": "<rootDir>/libs/common/src/$1",
    "^@libs/dao(|/.*)$": "<rootDir>/libs/dao/src/$1",
    "^@libs/auth(|/.*)$": "<rootDir>/libs/auth/src/$1"
  }
}
```

---

## 4. package.json 추가 스크립트

```json
{
  "scripts": {
    "test:identity": "jest --config apps/identity/jest-unit.json",
    "test:identity:cov": "jest --config apps/identity/jest-unit.json --coverage",
    "test:payment": "jest --config apps/payment/jest-unit.json",
    "test:payment:cov": "jest --config apps/payment/jest-unit.json --coverage",
    "test:e2e:identity": "jest --config apps/identity/jest-e2e.json --runInBand",
    "test:e2e:payment": "jest --config apps/payment/jest-e2e.json --runInBand",
    "test:all": "pnpm test:identity && pnpm test:payment",
    "test:all:cov": "pnpm test:identity:cov && pnpm test:payment:cov"
  }
}
```

---

## 5. Mock 팩토리

### `test-support/mocks/users-repository.mock.ts`

```typescript
import { UsersRepository } from '@libs/dao/personal/users/interfaces/users-repository.interface';

export const createUsersRepositoryMock = (): jest.Mocked<UsersRepository> => ({
  findById: jest.fn(),
  findByEmail: jest.fn(),
  countByEmail: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  findAllAndCount: jest.fn(),
});
```

### `test-support/mocks/session-repository.mock.ts`

```typescript
import { SessionRepository } from '@libs/dao/redis/session/repositories/session.repository';

export const createSessionRepositoryMock = () => ({
  getSession: jest.fn(),
  setSession: jest.fn(),
  deleteSession: jest.fn(),
});
```

### `test-support/mocks/bull-queue.mock.ts`

```typescript
export const createBullQueueMock = () => ({
  add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
  process: jest.fn(),
  on: jest.fn(),
});
```

### `test-support/fixtures/user.fixture.ts`

```typescript
import { UserEntity } from '@libs/dao/personal/users/entities/user.entity';

export const createUserFixture = (overrides?: Partial<UserEntity>): UserEntity => {
  const user = new UserEntity();
  user.id = 1;
  user.name = 'Test User';
  user.email = 'test@example.com';
  user.password = '$2b$10$hashedpassword';
  user.activatedAt = new Date('2024-01-01');
  user.checkPassword = jest.fn().mockResolvedValue(true);
  return Object.assign(user, overrides);
};
```

---

## 6. 단위 테스트 케이스

### 6-1. `libs/auth/src/auth/auth.service.spec.ts`

| 케이스 | 메서드 | 기댓값 |
|--------|--------|--------|
| 유효한 API 키를 반환한다 | `validateApiKey` | 매칭된 키 문자열 |
| 미등록 API 키는 undefined 반환 | `validateApiKey` | `undefined` |
| activatedAt이 있으면 true 반환 | `validateUser` | `true` |
| activatedAt이 없으면 false 반환 | `validateUser` | `false` |
| JWT 토큰을 생성한다 | `makeAuthToken` | 문자열 반환 |
| login 성공 시 UserDto 반환 | `login` | `UserDto` 인스턴스 |
| 세션이 없으면 UnauthorizedException | `validateSession` | throw |
| 세션 ID 불일치 시 UnauthorizedException | `validateSession` | throw |
| 유효한 세션 반환 | `validateSession` | `Session` 인스턴스 |

### 6-2. `libs/auth/src/user/user.service.spec.ts`

| 케이스 | 메서드 | 기댓값 |
|--------|--------|--------|
| 이미 가입된 이메일이면 에러 | `isDuplicated` | throw `ServerErrorException` |
| 중복 없으면 정상 통과 | `isDuplicated` | void |
| 복잡도 미달 비밀번호면 에러 | `isPasswordComplexity` | throw |
| 유효한 비밀번호면 통과 | `isPasswordComplexity` | void |
| 이름이 공백이면 에러 | `signup` | throw |
| 정상 가입 시 UserDto 반환 | `signup` | `UserDto` |
| 가입 후 메일 큐 등록 | `signup` | `queue.add` 호출 확인 |
| 이메일 없으면 에러 | `changePassword` | throw |
| 다른 사용자 비밀번호 변경 시 에러 | `changePassword` | throw |
| 본인 비밀번호 변경 성공 | `changePassword` | void |
| 비밀번호 불일치 시 에러 | `signIn` | throw |
| 미활성 계정 로그인 에러 | `signIn` | throw |
| 정상 로그인 시 UserDto 반환 | `signIn` | `UserDto` |
| 없는 ID 활성화 에러 | `activate` | throw |
| 활성화 성공 시 UserDto 반환 | `activate` | `UserDto` |
| 없는 ID 비활성화 에러 | `deactivate` | throw |
| 비활성화 성공 시 UserDto 반환 | `deactivate` | `UserDto` |
| updateRole은 미구현 에러 반환 | `updateRole` | throw |
| 페이지네이션 목록 반환 | `findAll` | `[UserDto[], PageMetaDto]` |
| 없는 ID 조회 에러 | `findById` | throw |
| 정상 ID 조회 | `findById` | `UserDto` |
| 없는 이메일 조회 에러 | `findByEmail` | throw |
| 없는 유저 삭제 에러 | `removeAdminUser` | throw |
| 정상 삭제 성공 | `removeAdminUser` | void |

### 6-3. `apps/identity/src/login/login.service.spec.ts`

| 케이스 | 메서드 | 기댓값 |
|--------|--------|--------|
| 기존 uuid면 기존 계정 반환 | `login` | 기존 `GameAccountDto` |
| 새 uuid면 계정 생성 후 반환 | `login` | 신규 `GameAccountDto` |
| 세션 저장 호출 확인 | `login` | `sessionRepository.setSession` 호출 |
| 세션 TTL 1시간으로 저장 | `login` | `setSession(..., 3600)` 확인 |

### 6-4. `apps/identity/src/queue/queue.service.spec.ts`

| 케이스 | 메서드 | 기댓값 |
|--------|--------|--------|
| 큐에 'test' 잡 추가 | `addQueue` | `queue.add('test', ...)` 호출 |
| 잡 객체 반환 | `addQueue` | job 객체 반환 |

### 6-5. `apps/identity/src/groq/groq.service.spec.ts`

| 케이스 | 메서드 | 기댓값 |
|--------|--------|--------|
| GroqProvider에 completion 요청 | `getGroqCompletion` | `groqProvider.getGroqChatCompletion` 호출 |
| completion 결과 반환 | `getGroqCompletion` | 응답 데이터 반환 |
| embedding 요청 전달 | `embedding` | `groqProvider.embedding` 호출 |
| embedding content 추출 반환 | `embedding` | `choices[0].message.content` 반환 |

---

## 7. E2E 테스트 케이스

### 7-1. Identity 서버 (`apps/identity/test/identity.e2e-spec.ts`)

#### POST `/auth/signup`

| 케이스 | 요청 | 응답 |
|--------|------|------|
| 정상 가입 | `{ name, email, password }` | `200`, `{ code: 0, data: UserDto }` |
| 이름 공백 | `{ name: '', email, password }` | `200`, `{ code: 99999 }` |
| 중복 이메일 | 중복된 email | `200`, `{ code: 99999 }` |
| 복잡도 미달 비밀번호 | 단순 password | `200`, `{ code: 99999 }` |

#### POST `/auth/login`

| 케이스 | 요청 | 응답 |
|--------|------|------|
| 정상 로그인 | `{ email, password }` | `200`, `{ code: 0, data: { token } }` |
| 잘못된 비밀번호 | 틀린 password | `200`, `{ code: 99999 }` |
| 미활성 계정 | 활성화 안된 계정 | `200`, `{ code: 99999 }` |

#### POST `/login` (게임 계정)

| 케이스 | 요청 | 응답 |
|--------|------|------|
| 신규 uuid 로그인 | `{ uuid }` | `200`, `{ code: 0, data: GameAccountDto }` |
| 기존 uuid 로그인 | 기존 `{ uuid }` | `200`, `{ code: 0, data: 기존 계정 }` |

#### GET `/user/list` (JWT 필요)

| 케이스 | 요청 | 응답 |
|--------|------|------|
| 정상 목록 조회 | Authorization 헤더 + 페이지네이션 파라미터 | `200`, `{ code: 0, data: [...] }` |
| 토큰 없음 | 헤더 없음 | `401` |

#### PATCH `/user/activate/:id` (JWT 필요)

| 케이스 | 요청 | 응답 |
|--------|------|------|
| 정상 활성화 | 유효한 id | `200`, `{ code: 0, data: UserDto }` |
| 없는 id | 존재하지 않는 id | `200`, `{ code: 99999 }` |

### 7-2. Payment 서버 (`apps/payment/test/payment.e2e-spec.ts`)

#### POST `/auth/signup`

Identity와 동일한 케이스 적용 (AuthModule 공유)

#### POST `/auth/login`

Identity와 동일한 케이스 적용

#### GET `/user/list` (JWT 필요)

Identity와 동일한 케이스 적용

---

## 8. 구현 예시

### 8-1. AuthService 단위 테스트 예시

```typescript
// libs/auth/src/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { SessionRepository } from '@libs/dao/redis/session/repositories/session.repository';
import { createSessionRepositoryMock } from '../../../test-support/mocks/session-repository.mock';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let sessionRepository: ReturnType<typeof createSessionRepositoryMock>;

  beforeEach(async () => {
    sessionRepository = createSessionRepositoryMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: { signIn: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('mock-token') },
        },
        {
          provide: SessionRepository,
          useValue: sessionRepository,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('validateApiKey', () => {
    it('환경변수에 등록된 API 키를 반환한다', () => {
      process.env.AUTH_KEY = 'valid-key';
      const result = service.validateApiKey('valid-key');
      expect(result).toBe('valid-key');
    });

    it('미등록 API 키는 undefined를 반환한다', () => {
      const result = service.validateApiKey('invalid-key');
      expect(result).toBeUndefined();
    });
  });

  describe('validateSession', () => {
    it('세션이 없으면 UnauthorizedException을 던진다', async () => {
      sessionRepository.getSession.mockResolvedValue(null);
      await expect(service.validateSession('1', 'session-id'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('세션 ID 불일치 시 UnauthorizedException을 던진다', async () => {
      sessionRepository.getSession.mockResolvedValue({ id: 'other-id' } as any);
      await expect(service.validateSession('1', 'session-id'))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});
```

### 8-2. Identity E2E 테스트 예시

```typescript
// apps/identity/test/identity.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { IdentityModule } from '../src/identity.module';
import { JwtAuthGuard } from '@libs/auth';
import { UsersRepository } from '@libs/dao/personal/users/interfaces/users-repository.interface';
import { createUsersRepositoryMock } from '../../../test-support/mocks/users-repository.mock';
import { createUserFixture } from '../../../test-support/fixtures/user.fixture';

describe('Identity E2E', () => {
  let app: INestApplication;
  const usersRepoMock = createUsersRepositoryMock();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [IdentityModule],
    })
      .overrideProvider(UsersRepository)
      .useValue(usersRepoMock)
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/signup', () => {
    it('정상 가입 시 code 0 반환', async () => {
      const userFixture = createUserFixture();
      usersRepoMock.countByEmail.mockResolvedValue(0);
      usersRepoMock.save.mockResolvedValue(userFixture);

      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'Test@12345!',
        });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
    });

    it('이름이 공백이면 에러 코드 반환', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ name: '   ', email: 'test@example.com', password: 'Test@12345!' });

      expect(res.body.code).not.toBe(0);
    });
  });

  describe('POST /auth/login', () => {
    it('정상 로그인 시 token 포함 응답', async () => {
      const userFixture = createUserFixture();
      usersRepoMock.findByEmail.mockResolvedValue(userFixture);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'Test@12345!' });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('token');
    });
  });
});
```

---

## 9. 구현 순서

1. **Mock 팩토리 생성** (`test-support/mocks/`, `test-support/fixtures/`)
2. **Jest 설정 파일 생성** (4개)
3. **package.json 스크립트 추가**
4. **libs/auth 단위 테스트 구현** (`auth.service.spec.ts`, `user.service.spec.ts`)
5. **Identity 앱 단위 테스트** (`login`, `queue`, `groq` spec 파일)
6. **Identity E2E 테스트** (`identity.e2e-spec.ts`)
7. **Payment E2E 테스트** (`payment.e2e-spec.ts`)
8. **커버리지 확인** — 목표 80% 이상

---

## 10. 실행 명령어

```bash
# Identity 단위 테스트
pnpm test:identity

# Identity 단위 테스트 + 커버리지
pnpm test:identity:cov

# Payment 단위 테스트
pnpm test:payment

# Identity E2E
pnpm test:e2e:identity

# Payment E2E
pnpm test:e2e:payment

# 전체 단위 테스트
pnpm test:all
```
