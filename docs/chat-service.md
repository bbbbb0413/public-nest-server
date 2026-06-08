# Chat Service

실시간 채팅 메시지 저장, 조회, 브로드캐스트를 담당하는 내부 서비스.

| 항목 | 내용 |
|---|---|
| 포트 | 50053 (gRPC), Socket.IO 내장 |
| DB | Redis (메시지 스트림, Pub/Sub), MongoDB (영구 저장) |
| 프로토콜 | gRPC (내부), Socket.IO + FlatBuffers (클라이언트) |

---

## gRPC — ChatService

Gateway에서 내부적으로 호출. `proto/chat.proto` 기준.

### `SaveMessage`
- 요청: `{ roomId: string, senderUuid: string, content: string }`
- 응답: `{ messageId: string, createdAt: number }`
- 동작:
  1. UUID 생성, 타임스탬프 설정
  2. FlatBuffers로 메시지 직렬화
  3. Redis 스트림에 저장 + Pub/Sub으로 브로드캐스트 (`persistAndNotify`)

### `GetMessages`
- 요청: `{ roomId: string, limit: number }`
- 응답: `{ messages: Message[] }`
- 동작: Redis에서 최근 메시지 히스토리 조회

---

## Socket.IO — 직접 연결 (내부)

### 네임스페이스: `/chat/ws`

| 이벤트 | 방향 | 설명 |
|---|---|---|
| `join_room` | Client → Server | 채팅방 입장. 요청: `{ roomId: string, lastTimestamp?: number }` |
| `leave_room` | Client → Server | 채팅방 퇴장. 요청: `{ roomId: string }` |
| `send_message` | Client → Server | 메시지 전송. 페이로드: FlatBuffers `SendMessageRequest` |

**join_room 처리 흐름**
- `lastTimestamp` 전달 시: 해당 시점 이후 메시지를 Redis에서 조회해 catch-up 전송
- `lastTimestamp` 미전달 시: 새 연결로 초기화

**send_message 처리 흐름**
1. FlatBuffers 디코딩 (`roomId`, `content`, `metadata`)
2. `join_room` 선행 여부 확인
3. UUID 생성, 마이크로초 타임스탬프
4. FlatBuffers로 직렬화 → `persistAndNotify`
   - Redis 스트림 저장
   - Pub/Sub으로 같은 방 구독자에게 브로드캐스트

---

## 메시지 포맷 (FlatBuffers)

**SendMessageRequest**
```
roomId: string
content: string
metadata: string (옵션)
```

**ChatMessage** (저장/전송 포맷)
```
messageId: string
status: MessageStatus (NORMAL / DELETED)
senderUuid: string
content: string
metadata: string
timestamp: int64 (밀리초)
eventTimestamp: int64 (마이크로초)
```
