# Chat Service

<!-- AUTO-GENERATED -->

**gRPC 포트**: 50053  
**역할**: 실시간 메시지 저장, FlatBuffer 직렬화, 채팅 히스토리 조회

## gRPC 서비스 (`ChatService`)

| 메서드 | 요청 | 응답 | 설명 |
|--------|------|------|------|
| `SaveMessage` | `{ roomId, senderUuid, content }` | `{ messageId, createdAt }` | 메시지 저장 |
| `GetMessages` | `{ roomId, limit }` | `{ messages[] }` | 메시지 히스토리 조회 |

**응답 메시지 구조**:

```typescript
ChatMessage {
  messageId: string
  senderUuid: string
  content: string
  createdAt: number  // 마이크로초 타임스탬프
}
```

## WebSocket 게이트웨이

**Namespace**: `/chat/ws`  
**Transport**: `websocket`

| 이벤트 | 방향 | 페이로드 | 응답 | 설명 |
|--------|------|----------|------|------|
| `join_room` | C→S | `{ roomId, lastTimestamp? }` | `{ success, error? }` | 방 입장. `lastTimestamp` 제공 시 그 이후 메시지 catch-up |
| `leave_room` | C→S | `{ roomId }` | `{ success }` | 방 퇴장 |
| `send_message` | C→S | `Buffer (FlatBuffer)` | `{ success, error? }` | 메시지 전송 |

### 메시지 전송 흐름

```
send_message (FlatBuffer Buffer)
  └─ FlatBuffer 역직렬화 (SendMessageRequest)
       ├─ roomId, content, metadata 추출
       ├─ UUID v4 messageId 생성
       ├─ 타임스탬프: Date.now() * 1000 (마이크로초 근사)
       └─ buildChatMessage() → Buffer
            └─ MessageService.persistAndNotify(roomId, buffer, ts, 'socket')
```

### FlatBuffer 스키마

메시지 직렬화에 FlatBuffer를 사용한다. 관련 파일:
- `apps/chat-service/src/flatbuffers/generated/chat.ts` — 생성된 타입
- `apps/chat-service/src/flatbuffers/builders.ts` — 빌더 유틸리티

**SendMessageRequest 필드**:

| 필드 | 타입 | 설명 |
|------|------|------|
| `roomId` | string | 대상 채팅방 ID |
| `content` | string | 메시지 내용 |
| `metadata` | string | 선택적 메타데이터 |

## 연결 관리

`SocketConnectionService`가 방별 마지막 플러시 타임스탬프를 관리한다.

- `initRoomLastFlushed(roomId)` — 방 초기화
- `updateRoomLastFlushed(roomId, ts)` — 타임스탬프 갱신
- `cleanupRoom(roomId)` — 방 상태 정리

## 의존성

| 의존 | 용도 |
|------|------|
| Redis / MongoDB | 메시지 영구 저장 |
| FlatBuffers | 고성능 이진 직렬화 |

<!-- /AUTO-GENERATED -->
