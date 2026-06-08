# Identity 서비스

게임 계정 인증, 메일, AI 완성, 큐 기능을 담당하는 내부 서비스.

| 항목 | 내용 |
|---|---|
| 포트 | 8080 (HTTP), 50051 (gRPC) |
| DB | MySQL (게임DB, 개인DB), MongoDB (로그), Redis |
| 외부 의존 | Groq API, Bull Queue |

---

## gRPC — IdentityService

Gateway에서 내부적으로 호출. `proto/identity.proto` 기준.

### `Login`
- 요청: `{ uuid: string }`
- 응답: `LoginResponse` (accessToken, refreshToken, session 정보)
- 동작: uuid로 GameAccount 조회 또는 생성 → 세션 발급

### `GetGameAccount`
- 요청: `{ uuid: string }`
- 응답: `GameAccountReply` (id, uuid, nickName)
- 동작: uuid로 GameAccount 조회. 없으면 `NOT_FOUND` 에러

### `SendMail`
- 요청: `{ accountId: number, title: string, body: string }`
- 응답: `SendMailResponse` (mailId)
- 동작: Mail 도메인 모델 생성 → 영속화

---

## REST API (내부 직접 접근)

### 로그인

#### `POST /login/login` — 게임 유저 로그인
- 요청: `LoginInDto` `{ uuid: string }`
- 응답: `LoginOutDto`

---

### AI 완성 (Groq)

#### `POST /chat/completion` — LLM 채팅 완성
- 요청: `GroqCompletionInDto`
- 응답: Groq API 응답 그대로 반환
- 내부: Groq SDK 직접 호출

#### `POST /chat/embedding` — 텍스트 임베딩
- 요청: `GroqCompletionInDto`
- 응답: 임베딩 벡터

---

### 큐

#### `POST /queue/add` — Bull 큐 작업 추가
- 요청: `AddQueueInDto`
- 응답: 큐 등록 결과
- 내부: Bull(Redis 기반) 큐에 작업 추가
