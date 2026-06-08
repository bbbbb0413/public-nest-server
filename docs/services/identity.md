# Identity Service

<!-- AUTO-GENERATED -->

**gRPC 포트**: 50051  
**역할**: 게임 계정 관리, 로그인, 메일 발송, WebSocket 채팅, LLM 완성

## gRPC 서비스 (`IdentityService`)

| 메서드 | 요청 | 응답 | 설명 |
|--------|------|------|------|
| `Login` | `{ uuid }` | `{ id, uuid, nickName }` | 게임 유저 로그인 |
| `GetGameAccount` | `{ uuid }` | `{ id, uuid, nickName }` | 계정 조회 (없으면 NOT_FOUND) |
| `SendMail` | `{ accountId, title, body }` | `{ mailId, delivered }` | 메일 발송 |

## HTTP 엔드포인트

### 로그인 (내부용)

| 메서드 | 경로 | 요청 | 응답 |
|--------|------|------|------|
| POST | `/login/login` | `{ uuid: string }` | `{ id, uuid, nickName }` |

### Queue

| 메서드 | 경로 | 요청 | 설명 |
|--------|------|------|------|
| POST | `/queue/add` | `{ name, email, password }` | Bull Queue에 작업 추가 |

### Groq LLM

| 메서드 | 경로 | 요청 | 설명 |
|--------|------|------|------|
| POST | `/chat/completion` | `{ content: string }` | LLM 채팅 완성 |
| POST | `/chat/embedding` | `{ content: string }` | 텍스트 임베딩 벡터 반환 |

## WebSocket 게이트웨이

**포트**: `SOCKET_PORT` 환경변수

| 이벤트 | 방향 | 페이로드 | 설명 |
|--------|------|----------|------|
| `setUserNick` | C→S | `nick: string` | 사용자 닉네임 설정 |
| `join` | C→S | `room: string` | 채팅방 입장 (히스토리 로드) |
| `exit` | C→S | `room: string` | 채팅방 퇴장 |
| `getUserList` | C→S | `room: string` | 방의 사용자 목록 조회 |
| `chatMessage` | C→S | `{ message: string }` | 채팅 메시지 전송 |
| `ping` | C→S | - | Redis TTL 갱신 (keep-alive) |
| `refresh-auth` | C→S | `token: string` | 토큰 갱신 |

## 도메인 모델

### GameAccount

```typescript
GameAccount {
  id: number
  uuid: Uuid         // Value Object
  nickName: NickName // Value Object
}
```

**팩토리**:
- `GameAccount.create({ uuid })` — 신규 생성, `GameAccountCreatedEvent` 발행
- `GameAccount.restore({ id, uuid, nickName })` — DB 복원

### Mail

메일 수신함 도메인. Personal Database에 저장.

## 의존성

| 의존 | 용도 |
|------|------|
| MySQL (Personal DB) | 계정, 메일 데이터 저장 |
| Redis | 채팅 히스토리, 소켓 연결 상태 |
| Bull Queue | 메시지 비동기 처리 |
| Groq API | LLM 완성 및 임베딩 |

<!-- /AUTO-GENERATED -->
