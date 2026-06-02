# Gateway + 내부 gRPC 전환 스펙

| 항목 | 내용 |
|---|---|
| 문서 상태 | Draft (v1) |
| 대상 저장소 | `/Users/seungwonkang/Documents/work/public-server` |
| 작성일 | 2026-06-01 |
| 적용 범위 | presentation 레이어 + 부트스트랩(main.ts) + 빌드 설정 |
| 비적용 범위 | domain / application / infrastructure 레이어 (변경 0건) |

---

## 1. 개요

### 1.1 목적
NestJS 모노레포 서버의 외부 통신 진입점을 `apps/gateway` 단일 애플리케이션으로 일원화하고,
내부 서비스 간 통신을 Redis 기반 메시지 패턴에서 **gRPC**로 전환한다.

### 1.2 배경
- 현재 외부 진입점이 각 서비스(`identity`, `payment`, `chat-service`)에 분산되어 있어 인증·라우팅·관측 지점이 일관되지 않다.
- `apps/payment`는 `Transport.REDIS` 마이크로서비스로 구동(`apps/payment/src/main.ts` 확인)되며, Redis transport는 강타입 계약과 스트리밍 지원이 약하다.
- 인증 전략(JWT / API-Key / Basic, `libs/auth`)이 여러 서비스에 중복 적용되어 있다.

### 1.3 목표
1. 모든 외부 REST/WS 트래픽을 Gateway 단일 진입점으로 통합한다.
2. 내부 통신을 gRPC(`@grpc/grpc-js` + `ts-proto`)로 표준화하여 강타입 계약을 확보한다.
3. 인증을 Gateway에서 일원화하고, 검증된 세션을 gRPC Metadata로 하위 서비스에 전파한다.
4. **domain / application / infrastructure 레이어는 한 줄도 변경하지 않는다.** presentation 레이어와 부트스트랩만 손댄다.
5. payment의 Redis transport를 제거한다.

### 1.4 비목표
- 도메인 모델 재설계, DB 스키마 변경, 인증 정책 자체의 변경은 범위 밖이다.
- gRPC ↔ 외부(클라이언트) 직접 노출은 하지 않는다. gRPC는 클러스터 내부 전용이다.

---

## 2. 아키텍처

### 2.1 Before

```
                  ┌──────────────────────────────┐
   외부 클라이언트  │  identity  (HTTP + Bull/Queue) │
   ───────────────▶│  자체 인증 (JWT/API-Key/Basic) │
                  └──────────────────────────────┘
                  ┌──────────────────────────────┐
   외부 클라이언트  │  payment  (HTTP + Redis MS)    │
   ───────────────▶│  자체 인증                      │
                  └──────────────┬───────────────┘
                                 │ Redis transport (MS)
                  ┌──────────────▼───────────────┐
   외부 클라이언트  │  chat-service (WebSocket)      │
   ───────────────▶│  자체 인증                      │
                  └──────────────────────────────┘
```

### 2.2 After

```
                         ┌─────────────────────────────────┐
   외부 REST  ──────────▶│            apps/gateway           │
   외부 WS    ──────────▶│  HTTP :3000 / WS                  │
                         │  인증 일원화 (JWT/API-Key/Basic)   │
                         │  GatewayAuthGuard → Session       │
                         │  gRPC client only                 │
                         └───┬───────────┬──────────────┬────┘
                gRPC(meta:session)  gRPC          gRPC
                             │           │              │
                  ┌──────────▼──┐ ┌──────▼──────┐ ┌─────▼────────┐
                  │ identity    │ │ payment     │ │ chat-service │
                  │ gRPC :50051 │ │ gRPC :50052 │ │ gRPC :50053  │
                  │ (RPC handler│ │ (Redis 제거) │ │ (WS→gRPC)    │
                  │  presentation)│ │             │ │              │
                  └─────────────┘ └─────────────┘ └──────────────┘

   * 모든 서비스의 domain/application/infrastructure 레이어는 변경 없음
   * gRPC 공유 계약은 libs/rpc 에서 관리
```

### 2.3 레이어 영향 범위

| 레이어 | 영향 | 비고 |
|---|---|---|
| presentation | 변경 (신규 gRPC 컨트롤러 추가, Gateway 컨트롤러 신규) | 기존 HTTP 컨트롤러는 Gateway로 이전/대체 |
| application | 변경 없음 | UseCase·Command 그대로 재사용 |
| domain | 변경 없음 | 모델·VO·이벤트 불변 |
| infrastructure | 변경 없음 | Repository·Mapper·Adapter 불변 |
| 부트스트랩(main.ts) | 변경 | payment: Redis 제거 / 각 서비스: gRPC microservice 추가 |
| 빌드 설정 | 변경 | nest-cli.json, tsconfig.paths.json, package.json |

> 핵심 원칙: gRPC 컨트롤러는 기존 HTTP 컨트롤러와 동일하게 application UseCase의 `execute()`를 호출하는 얇은 어댑터다. 비즈니스 로직은 절대 들어가지 않는다.

---

## 3. 기술 스택

### 3.1 신규 추가 의존성

| 패키지 | 종류 | 용도 |
|---|---|---|
| `@grpc/grpc-js` | dependency | 순수 JS gRPC 런타임 (NestJS 권장, native 의존성 없음) |
| `@grpc/proto-loader` | dependency | NestJS gRPC transport의 proto 동적 로딩 |
| `ts-proto` | devDependency | proto → TypeScript 강타입 인터페이스/클라이언트 코드 생성 |

> `@nestjs/microservices`(^9.4.3)는 이미 설치되어 있어 추가 불필요. `Transport.GRPC`를 그대로 사용한다.

### 3.2 선택 근거
- **`@grpc/grpc-js`**: C++ 바인딩(`grpc`)과 달리 순수 JS 구현이라 빌드/배포 환경 의존성이 없다. NestJS 공식 권장 드라이버.
- **`ts-proto`**: `@nestjs/microservices`가 기본 제공하는 인터페이스 생성보다 더 풍부한 타입(서비스 인터페이스, 클라이언트 타입)을 만들고, `nestJs: true` 옵션으로 `@GrpcMethod` 친화적 인터페이스를 출력한다.
- **버전 호환성**: 현재 NestJS 9 / TypeScript 4.7.4 / RxJS 7 환경과 호환되는 버전으로 고정한다(예: `@grpc/grpc-js` ^1.x, `ts-proto` ^1.x). 설치 후 `pnpm build`로 호환성을 1차 검증한다.

### 3.3 버전 고정 정책
- proto 생성 산출물은 `ts-proto` 버전에 종속되므로 `ts-proto` 버전을 `package.json`에 정확히 고정(`^` 최소화)한다.
- 생성 산출물(`libs/rpc/src/generated/*`)은 커밋 대상으로 관리하여 빌드 재현성을 확보한다.

---

## 4. proto 설계

### 4.1 파일 구조

```
libs/rpc/proto/
├── common.proto    # Session, Empty 등 공유 메시지
├── auth.proto      # AuthService.ValidateToken
├── identity.proto  # Login, GameAccount, Mail RPC
├── payment.proto   # 결제 생성/조회
└── chat.proto      # 메시지 저장/조회
```

### 4.2 package 네임스페이스

| proto 파일 | package | NestJS gRPC client name |
|---|---|---|
| common.proto | `rpc.common` | (공유, 클라이언트 없음) |
| auth.proto | `rpc.auth` | `AUTH_PACKAGE` |
| identity.proto | `rpc.identity` | `IDENTITY_PACKAGE` |
| payment.proto | `rpc.payment` | `PAYMENT_PACKAGE` |
| chat.proto | `rpc.chat` | `CHAT_PACKAGE` |

### 4.3 공통 정의 — `common.proto`

```protobuf
syntax = "proto3";
package rpc.common;

// shared-kernel 의 Session 과 1:1 대응
message Session {
  string id = 1;
  string uuid = 2;
  string nick_name = 3;
  int64  game_db_id = 4;
  string database = 5;
}

message Empty {}
```

> Session 필드는 `libs/shared-kernel`의 `Session`(id, uuid, nickName, gameDbId, database)과 정확히 매핑된다. Metadata 전파의 직렬화 단위로 사용한다.

### 4.4 인증 — `auth.proto`

```protobuf
syntax = "proto3";
package rpc.auth;

import "common.proto";

service AuthService {
  rpc ValidateToken (ValidateTokenRequest) returns (ValidateTokenResponse);
}

message ValidateTokenRequest {
  string scheme = 1;      // "jwt" | "apikey" | "basic"
  string credential = 2;  // 토큰/키/basic 디코딩 문자열
}

message ValidateTokenResponse {
  bool valid = 1;
  rpc.common.Session session = 2;
}
```

> Gateway가 인증을 일원화하므로 `AuthService`는 선택적이다. 인증 검증을 Gateway 인프로세스에서 처리하면 RPC 호출 자체가 불필요할 수 있다(아래 6.2 참고). 향후 인증 전용 서비스 분리에 대비해 계약만 정의해 둔다.

### 4.5 identity — `identity.proto`

```protobuf
syntax = "proto3";
package rpc.identity;

import "common.proto";

service IdentityService {
  rpc Login          (LoginRequest)          returns (LoginResponse);
  rpc GetGameAccount (GetGameAccountRequest) returns (GameAccountReply);
  rpc SendMail       (SendMailRequest)       returns (SendMailResponse);
}

message LoginRequest {
  string uuid = 1;
}

message LoginResponse {
  int64  id = 1;
  string uuid = 2;
  string nick_name = 3;
}

message GetGameAccountRequest {
  string uuid = 1;
}

message GameAccountReply {
  int64  id = 1;
  string uuid = 2;
  string nick_name = 3;
}

message SendMailRequest {
  int64  account_id = 1;
  string title = 2;
  string body = 3;
}

message SendMailResponse {
  int64 mail_id = 1;
  bool  delivered = 2;
}
```

### 4.6 payment — `payment.proto`

```protobuf
syntax = "proto3";
package rpc.payment;

service PaymentService {
  rpc CreatePayment (CreatePaymentRequest) returns (PaymentReply);
  rpc GetPayment    (GetPaymentRequest)    returns (PaymentReply);
}

message CreatePaymentRequest {
  int64  account_id = 1;
  int64  amount = 2;      // Money VO 의 amount
  string currency = 3;    // Money VO 의 currency
  string product_id = 4;
}

message GetPaymentRequest {
  int64 payment_id = 1;
}

message PaymentReply {
  int64  id = 1;
  int64  amount = 2;
  string currency = 3;
  string status = 4;
}
```

### 4.7 chat — `chat.proto`

```protobuf
syntax = "proto3";
package rpc.chat;

service ChatService {
  rpc SaveMessage (SaveMessageRequest) returns (SaveMessageResponse);
  rpc GetMessages (GetMessagesRequest) returns (GetMessagesResponse);
}

message SaveMessageRequest {
  string room_id = 1;
  string sender_uuid = 2;
  string content = 3;
}

message SaveMessageResponse {
  string message_id = 1;
  int64  created_at = 2;
}

message GetMessagesRequest {
  string room_id = 1;
  int32  limit = 2;
}

message ChatMessage {
  string message_id = 1;
  string sender_uuid = 2;
  string content = 3;
  int64  created_at = 4;
}

message GetMessagesResponse {
  repeated ChatMessage messages = 1;
}
```

### 4.8 proto 규약 (엄수)
- **필드 번호는 절대 재사용/변경하지 않는다.** 삭제 시 `reserved`로 막는다.
- 신규 필드는 항상 새 번호로 추가한다(하위 호환).
- 모든 message는 `snake_case` 필드명을 사용하고, ts-proto가 `camelCase`로 변환한다.
- 공유 메시지(`Session`, `Empty`)는 반드시 `common.proto`에만 정의하고 import한다.

---

## 5. 포트 / 서비스 구성

### 5.1 포트 테이블

| 서비스 | 외부 HTTP | 외부 WS | 내부 gRPC | 비고 |
|---|---|---|---|---|
| gateway | 3000 | 3000 (동일 포트) | — (gRPC 클라이언트만) | 유일한 외부 진입점 |
| identity | (제거) | — | 50051 | HTTP는 Gateway로 이전 |
| payment | (제거) | — | 50052 | 기존 Redis MS 제거 |
| chat-service | — | (제거) | 50053 | WS는 Gateway로 이전 |

### 5.2 환경 변수

| 변수 | 사용 주체 | 예시 | 설명 |
|---|---|---|---|
| `GATEWAY_HTTP_PORT` | gateway | `3000` | 외부 HTTP/WS 포트 |
| `IDENTITY_GRPC_URL` | gateway(client) / identity(server) | `0.0.0.0:50051` | identity gRPC 바인드/대상 |
| `PAYMENT_GRPC_URL` | gateway / payment | `0.0.0.0:50052` | payment gRPC |
| `CHAT_GRPC_URL` | gateway / chat-service | `0.0.0.0:50053` | chat gRPC |
| `JWT_SECRET` | gateway | (기존 값 재사용) | 인증 일원화에 사용 |
| `NODE_ENV` | 전체 | `prod` / `dev` | Swagger 노출 제어 등 |

> 기존 `SERVER_PORT`, `REDIS_DB_HOST`, `REDIS_DB_PORT`(payment)는 payment 부트스트랩에서 제거된다. 단, Redis가 세션/채팅 인프라(`libs/dao`, chat)에서 여전히 쓰이면 해당 env는 유지한다(transport 용도만 제거).

---

## 6. Gateway 설계

### 6.1 라우팅 테이블

| 외부 엔드포인트 | 메서드 | 대상 gRPC | RPC |
|---|---|---|---|
| `POST /auth/login` | REST | identity:50051 | `IdentityService.Login` |
| `GET  /accounts/:uuid` | REST | identity:50051 | `IdentityService.GetGameAccount` |
| `POST /mails` | REST | identity:50051 | `IdentityService.SendMail` |
| `POST /payments` | REST | payment:50052 | `PaymentService.CreatePayment` |
| `GET  /payments/:id` | REST | payment:50052 | `PaymentService.GetPayment` |
| `WS   /chat (send)` | WS | chat:50053 | `ChatService.SaveMessage` |
| `WS   /chat (history)` | WS | chat:50053 | `ChatService.GetMessages` |

### 6.2 인증 흐름

```
1. 외부 요청 → GatewayAuthGuard
2. Guard가 헤더에서 scheme 판별 (Authorization: Bearer → jwt / X-API-KEY → apikey / Basic → basic)
3. libs/auth 의 검증 로직으로 자격 증명 검증 (인프로세스)
   - 검증 실패 → 401 즉시 반환 (gRPC 호출 없음)
4. 검증 성공 → Session 객체 생성
5. Session 을 gRPC Metadata 로 직렬화하여 하위 서비스 호출
6. 하위 gRPC 컨트롤러는 Metadata 에서 Session 복원 후 application UseCase 호출
```

- 인증은 Gateway 프로세스 내부에서 `libs/auth` 전략을 재사용한다(별도 RPC 왕복 없음). `auth.proto`는 향후 인증 서비스 분리를 위한 예비 계약이다.
- 모든 보호된 라우트에 `GatewayAuthGuard` 적용. 공개 라우트(`/auth/login`)는 `@Public()` 데코레이터로 제외.

### 6.3 Metadata 전파 방식

```
// libs/rpc/src/metadata.util.ts (개념)
- toMetadata(session: Session): Metadata
    metadata.set('x-session-id',       session.id)
    metadata.set('x-session-uuid',     session.uuid)
    metadata.set('x-session-nickname', encodeURIComponent(session.nickName))
    metadata.set('x-session-game-db',  String(session.gameDbId))
    metadata.set('x-session-database', session.database)

- fromMetadata(metadata: Metadata): Session
    Session.create({ ... })   // 누락/형식 오류 시 명시적 예외
```

- gRPC Metadata 키는 소문자 ASCII만 허용되므로 `x-session-*` prefix를 사용한다.
- 비ASCII 값(nickName 등)은 `encodeURIComponent`로 인코딩 후 복원 시 디코딩한다.
- 복원 실패는 조용히 무시하지 않고 명시적 `UNAUTHENTICATED` gRPC 상태로 변환한다.

### 6.4 gRPC status ↔ HTTP status 매핑

| gRPC status | HTTP status |
|---|---|
| `OK (0)` | 200 |
| `INVALID_ARGUMENT (3)` | 400 |
| `UNAUTHENTICATED (16)` | 401 |
| `PERMISSION_DENIED (7)` | 403 |
| `NOT_FOUND (5)` | 404 |
| `ALREADY_EXISTS (6)` | 409 |
| `FAILED_PRECONDITION (9)` | 422 |
| `UNAVAILABLE (14)` | 503 |
| 그 외 | 500 |

> Gateway에 전역 `ExceptionFilter`를 두어 gRPC 에러(`RpcException` / `status` code)를 위 표대로 HTTP 응답으로 변환한다.

### 6.5 Observable → Promise 변환

NestJS gRPC 클라이언트 메서드는 `Observable`을 반환한다. Gateway REST 컨트롤러에서는 `firstValueFrom`(RxJS 7, 이미 설치됨)으로 Promise 변환 후 await한다.

```typescript
import { firstValueFrom } from 'rxjs';
const reply = await firstValueFrom(this.identitySvc.login(req, metadata));
```

---

## 7. 구현 단계

### Phase 0 — `libs/rpc` 골격 + proto 공통 + ts-proto 파이프라인

작업:
- `libs/rpc/proto/common.proto` 작성 (Session, Empty)
- `ts-proto` 설치 및 생성 스크립트 추가 (`pnpm proto:gen`)
- `nest-cli.json`에 `rpc` library 등록 + proto assets 등록
- `tsconfig.paths.json`에 `@libs/rpc` alias 추가
- `libs/rpc/src/` constants, grpc-options.factory, metadata.util, index.ts 작성

완료 기준:
- `pnpm proto:gen` 실행 시 `libs/rpc/src/generated/*` 산출
- `pnpm build`가 `@libs/rpc` import 포함하여 성공
- 기존 86개 단위 테스트 그대로 통과

### Phase 1 — payment 단일 서비스 gRPC 전환 (수직 슬라이스)

작업:
- `payment.proto` 작성 + 생성
- `apps/payment/src/payment/rpc/payment.grpc-controller.ts` 작성 (UseCase 호출)
- `apps/payment/src/payment/rpc/payment.grpc-mapper.ts` 작성 (proto ↔ Command/DTO)
- `apps/payment/src/main.ts`: `Transport.REDIS` 제거 → `Transport.GRPC` microservice로 교체
- payment 모듈에 gRPC 컨트롤러 등록

완료 기준:
- payment가 50052에서 gRPC 수신
- grpcurl 또는 테스트 클라이언트로 `CreatePayment`/`GetPayment` 동작
- payment domain/application/infrastructure 변경 0건 확인
- Redis transport 의존 제거 확인

### Phase 2 — Gateway 스캐폴딩 + 인증 일원화

작업:
- `apps/gateway/` 신규 앱 생성 (main.ts, gateway.module.ts, gateway.server.ts)
- `grpc-clients.module.ts`: payment gRPC 클라이언트 등록
- `auth/gateway-auth.guard.ts`: `libs/auth` 재사용 인증
- `payment/payment-gateway.controller.ts`: REST → gRPC 변환
- gRPC→HTTP 상태 매핑 ExceptionFilter
- `nest-cli.json`에 gateway app 등록

완료 기준:
- Gateway HTTP :3000에서 `POST /payments` → payment gRPC 왕복 성공
- 미인증 요청 401, 인증 요청 Session Metadata 전파 확인
- E2E: 로그인 토큰으로 결제 생성 happy path 통과

### Phase 3 — identity gRPC 핸들러 + Gateway 라우팅

작업:
- `identity.proto` + 생성
- identity `rpc/` gRPC 컨트롤러 + 매퍼 (Login, GameAccount, Mail)
- `apps/identity/src/main.ts`에 gRPC microservice(:50051) 추가
- Gateway에 identity 클라이언트 + REST 컨트롤러 등록

완료 기준:
- `/auth/login`, `/accounts/:uuid`, `/mails` Gateway 경유 동작
- identity 비presentation 레이어 변경 0건
- 단위 + E2E 통과

### Phase 4 — chat-service gRPC + WS Gateway 이전 + 정리

작업:
- `chat.proto` + 생성
- chat `rpc/` gRPC 컨트롤러 + 매퍼
- `apps/chat-service/src/main.ts`에 gRPC microservice(:50053) 추가
- Gateway에 WS 게이트웨이 이전 (chat 송수신을 gRPC로 중계)
- WS + gRPC 부트 순서 정리, 레거시 외부 진입점 제거
- 문서/README 갱신

완료 기준:
- WS 연결 → Gateway → chat gRPC 메시지 저장/조회 동작
- 모든 외부 진입점이 Gateway로 단일화됨
- payment의 Redis transport 완전 제거 확인
- 전체 테스트 + `pnpm build` 통과

> 각 Phase는 독립 머지 가능. Phase 1(payment 수직 슬라이스) 완료 시점에 이미 한 서비스가 동작하는 end-to-end 경로가 존재한다.

---

## 8. 파일 목록

### 8.1 신규 생성 파일

| 경로 | 설명 |
|---|---|
| `libs/rpc/proto/common.proto` | Session, Empty 공유 메시지 |
| `libs/rpc/proto/auth.proto` | AuthService.ValidateToken (예비) |
| `libs/rpc/proto/identity.proto` | Login / GameAccount / Mail RPC |
| `libs/rpc/proto/payment.proto` | CreatePayment / GetPayment |
| `libs/rpc/proto/chat.proto` | SaveMessage / GetMessages |
| `libs/rpc/src/constants.ts` | 패키지명·포트·Metadata 키 상수 |
| `libs/rpc/src/grpc-options.factory.ts` | `Transport.GRPC` 옵션 팩토리(서버/클라이언트) |
| `libs/rpc/src/metadata.util.ts` | Session ↔ gRPC Metadata 변환 |
| `libs/rpc/src/generated/*.ts` | ts-proto 생성 타입/인터페이스 |
| `libs/rpc/src/index.ts` | 배럴 export |
| `libs/rpc/tsconfig.lib.json` | rpc 라이브러리 TS 설정 |
| `apps/gateway/src/main.ts` | Gateway 부트스트랩 (HTTP + WS) |
| `apps/gateway/src/gateway.module.ts` | Gateway 루트 모듈 |
| `apps/gateway/src/gateway.server.ts` | 서버 초기화/Swagger |
| `apps/gateway/src/grpc-clients.module.ts` | gRPC 클라이언트 등록 |
| `apps/gateway/src/auth/gateway-auth.guard.ts` | 인증 일원화 Guard |
| `apps/gateway/src/identity/identity-gateway.controller.ts` | identity REST→gRPC |
| `apps/gateway/src/payment/payment-gateway.controller.ts` | payment REST→gRPC |
| `apps/gateway/src/chat/chat-gateway.controller.ts` | chat WS→gRPC |
| `apps/gateway/tsconfig.app.json` | Gateway 앱 TS 설정 |
| `apps/gateway/jest-unit.json` | Gateway 단위 테스트 설정 |
| `apps/*/src/**/rpc/*.grpc-controller.ts` | 각 서비스 gRPC 컨트롤러 (5종) |
| `apps/*/src/**/rpc/*.grpc-mapper.ts` | proto ↔ Command/DTO 매퍼 (5종) |
| `docs/spec/gateway-grpc-migration.md` | 본 스펙 문서 |

### 8.2 수정 파일

| 경로 | 변경 내용 |
|---|---|
| `package.json` | `@grpc/grpc-js`, `@grpc/proto-loader` 추가, `ts-proto`(dev) 추가, `proto:gen` 스크립트 추가, `test:gateway` 추가 |
| `nest-cli.json` | `gateway` app, `rpc` library, proto `assets`(dist 복사) 등록 |
| `tsconfig.paths.json` | `@libs/rpc`, `@libs/rpc/*` alias 추가 |
| `apps/payment/src/main.ts` | `Transport.REDIS` 제거 → `Transport.GRPC` microservice |
| `apps/identity/src/main.ts` | gRPC microservice(:50051) 추가 |
| `apps/chat-service/src/main.ts` | gRPC microservice(:50053) 추가 |
| `apps/payment/src/payment.module.ts` | gRPC 컨트롤러 등록 |
| `apps/identity/src/**/*.module.ts` | gRPC 컨트롤러 등록 |
| `apps/chat-service/src/**/*.module.ts` | gRPC 컨트롤러 등록 |

> `nest-cli.json` `compilerOptions.assets`에 `{ "include": "../../libs/rpc/proto/**/*.proto", "outDir": "dist", "watchAssets": true }` 형태로 proto를 dist에 복사해야 런타임 로딩이 가능하다(리스크 1 참고).

---

## 9. 테스트 전략

### 9.1 단위 테스트
- **gRPC 매퍼**: proto 메시지 ↔ Command/도메인 변환 정확성 (AAA 패턴).
- **metadata.util**: Session ↔ Metadata 왕복 변환, 비ASCII(nickName) 인코딩/디코딩, 누락 필드 예외.
- **GatewayAuthGuard**: scheme 판별, 인증 실패 시 401, 성공 시 Session 생성.
- 포트 Symbol 토큰으로 UseCase mock 주입 (기존 컨벤션 유지).
- 기존 86개 테스트는 전 Phase에서 회귀 없이 통과해야 한다.

### 9.2 통합 테스트
- 각 서비스의 gRPC 컨트롤러 ↔ 실제 UseCase ↔ 테스트 DB 왕복.
- 인메모리/테스트 gRPC 서버를 띄워 `CreatePayment`, `Login`, `SaveMessage` 호출 검증.
- gRPC status → HTTP status 매핑 필터 단위/통합 검증.

### 9.3 E2E 테스트
- Gateway HTTP 진입 → 하위 gRPC → 응답까지 full path.
  - 결제 happy path: 로그인 토큰 발급 → `POST /payments` → 200.
  - 인증 실패: 토큰 없이 `POST /payments` → 401.
  - 미존재 조회: `GET /payments/:id` → 404 (NOT_FOUND 매핑).
- WS E2E: 연결 → 메시지 전송 → chat gRPC 저장 → 히스토리 조회.
- 응답 스키마 회귀 방지(기존 E2E 컨벤션과 동일).

### 9.4 테스트 명령

```bash
pnpm test:payment    # Phase 1
pnpm test:gateway    # Phase 2 (신규)
pnpm test:identity   # Phase 3
pnpm test:chat       # Phase 4
pnpm test:all        # 전체
pnpm build           # 빌드 검증 (proto 생성 포함 파이프라인 확인)
```

---

## 10. 리스크 및 대응

| # | 리스크 | 심각도 | 대응 방안 |
|---|---|---|---|
| 1 | proto 파일이 `dist`로 복사되지 않아 런타임 로딩 실패 | High | `nest-cli.json` `assets`에 proto include + `watchAssets: true`. 빌드 후 `dist`에 `.proto` 존재 검증 단계 추가 |
| 2 | gRPC 클라이언트의 `Observable` 반환을 await 누락 | Medium | Gateway 컨트롤러에서 일괄 `firstValueFrom`(RxJS 7) 사용. 린트 규칙/리뷰 체크리스트화 |
| 3 | gRPC status ↔ HTTP status 매핑 누락/오류 | Medium | 전역 ExceptionFilter + 매핑 표(6.4) 단위 테스트로 고정 |
| 4 | WS + gRPC microservice 부트 순서 충돌 | Medium | `app.connectMicroservice` → `startAllMicroservices` → `app.listen` 순서 고정. Gateway WS는 HTTP 서버 기동 후 바인드 |
| 5 | proto 필드 번호 변경/재사용으로 하위 호환 깨짐 | High | 필드 번호 불변 규약(4.8), 삭제 시 `reserved`. PR 리뷰에서 proto diff 필수 점검 |
| 6 | Metadata 키 대소문자/비ASCII 제약 위반 | Low | `x-session-*` 소문자 prefix + `encodeURIComponent`. metadata.util 단위 테스트 |
| 7 | ts-proto 버전 변경으로 생성 산출물 표류 | Medium | `ts-proto` 버전 고정 + 생성물 커밋 + CI에서 `proto:gen` 재생성 후 diff 검증 |
| 8 | payment Redis 제거 시 세션/채팅 Redis와 혼동 | Medium | transport 용 Redis만 제거. 세션/채팅 Redis(`libs/dao`, chat) env·코드는 보존 |
| 9 | 비presentation 레이어 우발적 수정 | High | PR diff에서 domain/application/infrastructure 변경 0건을 머지 게이트로 검증 |

---

## 11. 성공 기준

- [ ] `libs/rpc`가 `@libs/rpc` alias로 import되고 `pnpm build` 성공
- [ ] `pnpm proto:gen`으로 5종 proto가 타입 생성되며 산출물이 커밋됨
- [ ] proto가 `dist`에 복사되어 런타임 gRPC 로딩 성공
- [ ] payment가 Redis transport 없이 gRPC :50052에서 동작
- [ ] identity gRPC :50051, chat-service gRPC :50053 동작
- [ ] 모든 외부 REST/WS 트래픽이 Gateway :3000 단일 진입점 경유
- [ ] Gateway에서 JWT/API-Key/Basic 인증 일원화, Session이 Metadata로 전파됨
- [ ] gRPC status가 HTTP status로 올바르게 매핑됨 (6.4 표 기준)
- [ ] domain / application / infrastructure 레이어 변경 0건 확인됨
- [ ] 기존 86개 단위 테스트 + 신규 Gateway 테스트 전부 통과
- [ ] 결제 생성 / 로그인 / 채팅 메시지 E2E happy path 통과
- [ ] 테스트 커버리지 80% 이상 유지
