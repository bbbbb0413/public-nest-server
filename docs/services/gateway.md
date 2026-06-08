# Gateway Service

<!-- AUTO-GENERATED -->

**포트**: 3000  
**프로토콜**: HTTP, WebSocket  
**역할**: 단일 진입점. HTTP 요청을 gRPC 마이크로서비스로 변환하고, WebSocket 채팅을 중계한다.

## HTTP 엔드포인트

### Identity

| 메서드 | 경로 | 인증 | 요청 | 응답 | 설명 |
|--------|------|------|------|------|------|
| POST | `/auth/login` | Public | `{ uuid: string }` | `LoginResponse` | 게임 유저 로그인 |
| GET | `/accounts/:uuid` | JWT | - | `GameAccountReply` | 게임 유저 정보 조회 |
| POST | `/mails` | JWT | `{ accountId, title, body }` | `SendMailResponse` | 메일 발송 |

### Payment

| 메서드 | 경로 | 인증 | 요청 | 응답 | 설명 |
|--------|------|------|------|------|------|
| POST | `/payments` | JWT | `{ amount, currency, productId }` | `PaymentReply` | 결제 생성 |
| GET | `/payments/:id` | JWT | - | `PaymentReply` | 결제 조회 |

> `accountId`는 JWT 세션의 `gameDbId`에서 자동 설정된다.

## WebSocket 게이트웨이

**Namespace**: `/chat/ws`  
**Transport**: `websocket`

| 이벤트 | 방향 | 페이로드 | 응답 | 설명 |
|--------|------|----------|------|------|
| `join_room` | C→S | `{ roomId: string }` | `{ success: boolean, error? }` | 채팅방 입장 |
| `leave_room` | C→S | `{ roomId: string }` | `{ success: boolean }` | 채팅방 퇴장 |
| `send_message` | C→S | `Buffer (FlatBuffer)` | `{ success: boolean, error? }` | 메시지 전송 |

### WebSocket 인증

연결 시 토큰을 전달해야 한다.

```
handshake.auth.token  또는  handshake.query.token
```

인증 실패 시 즉시 `client.disconnect(true)` 호출.

## 인증 Guard (`GatewayAuthGuard`)

인증 타입은 `Authorization` 헤더로 구분한다.

| 타입 | 헤더 형식 | 처리 결과 |
|------|----------|----------|
| JWT | `Bearer <token>` | Session 생성 |
| Basic | `Basic <credentials>` | Session 유지 |
| API Key | `X-API-Key: <key>` | 시스템 Session |

`@Public()` 데코레이터가 붙은 엔드포인트는 인증을 건너뛴다.

## 상위 레벨 의존성

```
Gateway
├─ gRPC → Identity Service (50051)
├─ gRPC → Payment Service (50052)
└─ gRPC → Chat Service (50053)
```

<!-- /AUTO-GENERATED -->
