# 라이브러리 개요

<!-- AUTO-GENERATED -->

## libs/auth

인증 및 관리자 사용자 관리 BC.

### Auth 컨트롤러

| 메서드 | 경로 | 요청 | 응답 | 설명 |
|--------|------|------|------|------|
| POST | `/auth/signup` | `{ email, password }` | `UserOutDto` | 관리자 계정 생성 |
| POST | `/auth/login` | `{ email, password }` | `{ user, authToken }` | 관리자 로그인 |

**JWT Payload**: `{ id, name, email, activatedAt }`

### User 컨트롤러 (JWT 인증 필수)

| 메서드 | 경로 | 요청 | 응답 | 설명 |
|--------|------|------|------|------|
| GET | `/user` | Query: `PageOptionsDto` | `UserOutDto[]` (페이지) | 관리자 목록 조회 |
| GET | `/user/:id` | - | `UserOutDto` | 관리자 정보 조회 |
| PUT | `/user/activate` | `{ userId, activate }` | `UserOutDto` | 활성화/비활성화 |
| PUT | `/user/role` | `{ userId, role }` | `UserOutDto` | 권한 변경 |
| POST | `/user/change/password` | `{ email, password }` | 200 OK | 비밀번호 변경 |
| DELETE | `/user/:id` | - | 200 OK | 관리자 삭제 |

### 인증 전략

| 전략 | 클래스 | 설명 |
|------|--------|------|
| JWT | `JwtStrategy` | Bearer 토큰 검증 |
| API Key | `ApiKeyStrategy` | `X-API-Key` 헤더 검증 |
| Basic | `BasicStrategy` | Basic Auth 검증 |

---

## libs/llm

다중 LLM 프로바이더를 추상화하는 라이브러리.

### 포트 인터페이스

```typescript
ILlmProvider {
  complete(prompt: string): AsyncIterable<string>
}

IEmbeddingProvider {
  embed(text: string): Promise<number[]>
}
```

### 프로바이더 구현체

| 환경변수 값 | 클래스 | 대상 모델 |
|------------|--------|----------|
| `claude` | `ClaudeProvider` | Claude 3.x (Anthropic) |
| `openai` | `OpenAIProvider` | GPT-4o 계열 |
| `gemini` | `GeminiProvider` | Gemini 1.5 계열 |
| `groq` | `GroqProvider` | Llama3, Mixtral 등 |
| `ollama` | `OllamaProvider` | 로컬 모델 (llama3 등) |

### 임베딩 구현체

| 환경변수 값 | 클래스 |
|------------|--------|
| `openai` | `OpenAIEmbeddingProvider` |
| `ollama` | `OllamaEmbeddingProvider` |

---

## libs/rpc

gRPC 클라이언트/서버 타입 정의.

### 생성된 인터페이스

| 인터페이스 | 패키지 | 포트 |
|-----------|--------|------|
| `IdentityServiceClient/Controller` | `identity.proto` | 50051 |
| `PaymentServiceClient/Controller` | `payment.proto` | 50052 |
| `ChatServiceClient/Controller` | `chat.proto` | 50053 |

### Session 유틸리티

```typescript
toMetadata(session: Session): Metadata
```

gRPC 메타데이터에 Session 정보를 직렬화해 서비스 간 전달할 때 사용한다.

---

## libs/shared-kernel

모든 BC의 domain 레이어가 상속하는 기반 클래스.

### 주요 클래스

```typescript
abstract class ValueObject<T> {
  protected abstract validate(value: T): void
  equals(other: ValueObject<T>): boolean
  getValue(): T
}

abstract class AggregateRoot {
  protected addDomainEvent(event: DomainEvent): void
  pullDomainEvents(): DomainEvent[]
}

abstract class DomainEvent {
  readonly occurredAt: Date
}

class Session {
  id: string
  uuid: string
  nickName: string
  gameDbId: number
  database: string

  static create(partial?: Partial<Session>): Session
}
```

---

## libs/common

공통 인프라 유틸리티.

### 주요 모듈

| 모듈/유틸 | 설명 |
|-----------|------|
| `TypeOrmExModule` | 멀티 DataSource TypeORM 설정 |
| `MongoModule` | MongoDB 연결 |
| `ResponseEntity` | 표준 API 응답 래퍼 |
| `PageOptionsDto` / `PageMetaDto` | 페이지네이션 |
| `@CurrentUser()` | 요청 세션에서 유저 추출 데코레이터 |
| `@ApiResponseEntity()` | Swagger 응답 타입 데코레이터 |
| `AuthenticatedRedisIoAdapter` | Redis 기반 Socket.IO 어댑터 |

### DB 설정

```typescript
import PersonalDatabaseConfig from '@libs/common/config/database/personal-database.config';
import GameDatabaseConfig from '@libs/common/config/database/game-database.config';
import PaymentDatabaseConfig from '@libs/common/config/database/payment-database.config';
```

<!-- /AUTO-GENERATED -->
