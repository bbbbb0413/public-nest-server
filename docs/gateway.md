# Gateway 서비스

외부 트래픽의 단일 진입점. 인증 처리 후 내부 서비스(Identity, Payment, Chat)로 gRPC로 라우팅한다.

| 항목 | 내용 |
|---|---|
| 포트 | 3000 |
| 인증 | JWT Bearer Token (`GatewayAuthGuard`) |
| 내부 통신 | gRPC |

---

## REST API

### 인증

#### `POST /auth/login` — 게임 유저 로그인
- 인증: 불필요 (`@Public()`)
- 요청: `{ uuid: string }`
- 응답: `LoginResponse` (access token 포함)
- 내부: Identity gRPC `Login` 호출

---

### 게임 계정

#### `GET /accounts/:uuid` — 게임 유저 정보 조회
- 인증: JWT 필요
- 파라미터: `uuid` (게임 유저 UUID)
- 응답: `GameAccountReply`
- 내부: 세션을 gRPC Metadata로 전달 → Identity `GetGameAccount` 호출

---

### 메일

#### `POST /mails` — 메일 발송
- 인증: JWT 필요
- 요청: `{ accountId: number, title: string, body: string }`
- 응답: `SendMailResponse`
- 내부: Identity `SendMail` gRPC 호출

---

### 결제

#### `POST /payments` — 결제 생성
- 인증: JWT 필요
- 요청: `{ amount: number, currency: string, productId: string }`
- 응답: `PaymentReply`
- 내부: Payment `CreatePayment` gRPC 호출 (accountId는 세션에서 주입)

#### `GET /payments/:id` — 결제 조회
- 인증: JWT 필요
- 파라미터: `id` (결제 ID, 정수)
- 응답: `PaymentReply`
- 내부: Payment `GetPayment` gRPC 호출

---

## WebSocket

### 네임스페이스: `/chat/ws`

연결 시 `handshake.auth.token` 또는 `handshake.query.token`으로 JWT 검증. 토큰 없으면 즉시 연결 차단.

| 이벤트 | 방향 | 설명 |
|---|---|---|
| `join_room` | Client → Server | 채팅방 입장. 요청: `{ roomId: string }` |
| `leave_room` | Client → Server | 채팅방 퇴장. 요청: `{ roomId: string }` |
| `send_message` | Client → Server | 메시지 전송. 페이로드: FlatBuffers `SendMessageRequest` |

**send_message 처리 흐름**
1. FlatBuffers 디코딩 (`roomId`, `content` 추출)
2. `join_room` 선행 여부 확인
3. 세션으로 gRPC Metadata 구성
4. Chat `SaveMessage` gRPC 호출
