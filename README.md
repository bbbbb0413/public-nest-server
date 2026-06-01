# public-server

NestJS 기반 모노레포 백엔드 시스템.  
**DDD(Domain-Driven Design) + Clean Architecture** 구조로 설계되어 있습니다.

---

## 1. 프로젝트 개요

인증·결제·실시간 채팅을 독립 서비스로 분리한 분산 백엔드입니다.  
멀티 데이터베이스(MySQL, Redis, MongoDB)를 지원하며, 각 Bounded Context(BC)가 자체 도메인 모델과 인프라를 보유합니다.

---

## 2. 기술 스택

| 분류 | 기술 |
|---|---|
| 런타임 | Node.js + TypeScript |
| 프레임워크 | NestJS (모노레포) |
| ORM | TypeORM (MySQL) |
| 캐시/메시지 | Redis (세션, 채팅, Pub/Sub) |
| 비동기 큐 | Bull (Redis 기반) |
| 로그 | MongoDB |
| 직렬화 | FlatBuffers (채팅 메시지) |
| 패키지매니저 | pnpm |

---

## 3. 아키텍처

### 4-레이어 Clean Architecture

각 Bounded Context는 다음 4개 레이어로 구성됩니다.

```
presentation/   ← Controller, WebSocket Gateway, 요청/응답 DTO
application/    ← UseCase, Command
domain/         ← 순수 도메인 모델, ValueObject, 포트(Repository 인터페이스)
infrastructure/ ← ORM Entity, Mapper, Repository 구현체, Redis 어댑터
```

**의존성 방향**: `presentation → application → domain ← infrastructure`  
domain 레이어는 어떤 프레임워크에도 의존하지 않습니다.

---

## 4. 디렉토리 구조

```
apps/
├── identity/               # 인증 · 게임계정 · 메일 · 큐 서비스
│   └── src/
│       ├── account/        # BC: 게임계정 로그인 (presentation/application/domain/infrastructure)
│       ├── mail/           # BC: 메일 발송
│       ├── socket/         # WebSocket 채팅 게이트웨이
│       ├── queue/          # Bull 큐 소비자 (메일 발송, 채팅 히스토리)
│       ├── groq/           # Groq LLM API 연동
│       └── infrastructure/ # Redis Chat 인프라 (앱 내부 전용)
│
├── payment/                # 결제 서비스
│   └── src/
│       └── payment/        # BC: 결제 (presentation/application/domain/infrastructure)
│
└── chat-service/           # 실시간 채팅 서비스
    └── src/
        ├── message/        # BC: 채팅 메시지 (domain/port, infrastructure/adapter)
        ├── socket/         # WebSocket 게이트웨이 (presentation)
        ├── pubsub/         # Sharded Redis Pub/Sub
        ├── flatbuffers/    # FlatBuffers 직렬화 코덱
        └── infrastructure/ # Redis 인프라 (chat-service 전용)

libs/
├── shared-kernel/          # 공유 도메인 기반 클래스
│   └── src/
│       ├── domain/         # ValueObject, AggregateRoot, DomainEvent
│       └── session/        # Session 도메인 타입
│
├── auth/                   # 인증 Bounded Context
│   └── src/
│       ├── auth/           # JWT/API-Key/Basic 전략, AuthService, SessionRepository
│       └── user/           # User 도메인 (Email VO, Password VO, bcrypt 캡슐화)
│
└── common/                 # 공통 인프라 레이어
    └── src/
        ├── config/         # DB 설정 (personal, game, payment, redis)
        ├── databases/      # TypeORM AbstractRepository, Redis 팩토리
        ├── decorator/      # 공통 데코레이터
        ├── filter/         # 전역 예외 필터
        ├── interceptor/    # 트랜잭션, 유저락 인터셉터
        ├── network/        # ResponseEntity 래퍼
        └── pagination/     # 페이지네이션 DTO
```

---

## 5. Bounded Context 목록

| BC | 위치 | 주요 도메인 객체 |
|---|---|---|
| Account (게임계정) | `apps/identity/src/account/` | `GameAccount`, `Uuid VO`, `NickName VO` |
| User (관리자) | `libs/auth/src/user/` | `User`, `Email VO`, `Password VO` |
| Payment (결제) | `apps/payment/src/payment/` | `Payment`, `Money VO` |
| Mail (메일) | `apps/identity/src/mail/` | `Mail` |
| Chat (채팅) | `apps/chat-service/src/message/` | 포트: `IChatMessageStore`, `IPubSubPort` |

---

## 6. 데이터베이스 아키텍처

### MySQL (RDB)
- **personal DB**: `user`(어드민), `mail`(메일 로그), `payment`(결제) 테이블
- **game DB**: `game_account`(게임 계정), `game_user`(게임 유저) 테이블

### Redis
- **세션**: 로그인 세션 토큰 저장
- **채팅**: Sharded Pub/Sub 채널, 메시지 ZSET 저장

### MongoDB
- 감사 로그, 디버깅용 대용량 비정형 로그

---

## 7. 실행 방법

### 환경변수 설정

`config/` 디렉토리에 서비스별 `.env` 파일을 생성합니다.

```
config/
├── .identity.local.env
├── .payment.local.env
└── .chat-service.local.env
```

주요 환경변수 예시:

```env
# MySQL - Personal DB
PERSONAL_DB_HOST=localhost
PERSONAL_DB_PORT=3306
PERSONAL_DB_NAME=personal
PERSONAL_DB_USER_NAME=root
PERSONAL_DB_USER_PW=password

# MySQL - Game DB
GAME_DB_HOST=localhost
GAME_DB_PORT=3306
GAME_DB_NAME=game
GAME_DB_USER_NAME=root
GAME_DB_USER_PW=password

# Redis
REDIS_DB_HOST=localhost
REDIS_DB_PORT=6379

# Auth
ACCESS_TOKEN_SECRET=your_jwt_secret
AUTH_KEY=your_api_key

# Groq LLM
GROQ_API_KEY=your_groq_api_key
```

### 인프라 실행 (Docker)

```sh
docker-compose -f docker/docker-compose.yml up -d db redis mongo
```

### 로컬 개발 실행

```sh
# 의존성 설치
pnpm install

# 서비스별 개발 모드 실행
pnpm start:dev identity
pnpm start:dev payment
pnpm start:dev chat-service
```

### 전체 빌드

```sh
pnpm build
```

---

## 8. 테스트

```sh
# 서비스별 단위 테스트
pnpm test:identity    # identity + auth (40개)
pnpm test:payment     # payment + auth (36개)
pnpm test:chat        # chat-service (10개)

# 전체 단위 테스트
pnpm test:all         # 86개

# 커버리지 리포트
pnpm test:all:cov

# E2E 테스트
pnpm test:e2e:identity
pnpm test:e2e:payment
```

---

## 9. 새 Bounded Context 추가 절차

1. `domain/model/{name}.ts` — `AggregateRoot` 상속, `create()` / `restore()` 팩토리
2. `domain/vo/*.vo.ts` — `ValueObject<T>` 상속
3. `domain/repository/{name}.repository.ts` — 포트 인터페이스 + Symbol
4. `infrastructure/orm/{name}.orm-entity.ts` — `@Entity()` 전용 ORM 엔티티
5. `infrastructure/mapper/{name}.mapper.ts` — `toDomain()` / `toOrmEntity()`
6. `infrastructure/persistence/{name}.repository-impl.ts` — 포트 구현체
7. `application/{name}.use-case.ts` — `execute(command)` 단일 메서드
8. `presentation/{name}.controller.ts` + DTO
9. `{bc-name}.module.ts` — 포트/어댑터 바인딩
10. 앱 모듈 `imports`에 BC 모듈 추가

---

## 10. 관련 문서

- [`CLAUDE.md`](./CLAUDE.md) — 아키텍처 상세, 코드 컨벤션, 파일 네이밍 규칙
- [`docs/ddd-migration-debt.md`](./docs/ddd-migration-debt.md) — 마이그레이션 이력 및 잔존 부채
- [`docs/chat.md`](./docs/chat.md) — 채팅 서비스 설계 문서
