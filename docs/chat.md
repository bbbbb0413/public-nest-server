# Chat Service Socket.IO 개발 명세서

> **버전**: 1.0  
> **최종 수정**: 2026-04-10

---

## 목차

1. [개요](#1-개요)
2. [설계 원칙](#2-설계-원칙)
3. [시스템 아키텍처](#3-시스템-아키텍처)
4. [연결 및 인증](#4-연결-및-인증)
5. [이벤트 인터페이스](#5-이벤트-인터페이스)
6. [메시지 전달 흐름](#6-메시지-전달-흐름)
7. [방 관리](#7-방-관리)
8. [크로스 Pod 동기화](#8-크로스-pod-동기화)
9. [상태 관리](#9-상태-관리)
10. [동시성 제어](#10-동시성-제어)
11. [에러 처리](#11-에러-처리)
12. [NestJS 구현 패턴](#12-nestjs-구현-패턴)
13. [모듈 구조 및 디렉터리](#13-모듈-구조-및-디렉터리)
14. [운영](#14-운영)

---

## 1. 개요

### 1.1. 목적

Chat Service의 Socket.IO 양방향 실시간 통신 채널에 대한 개발 명세서이다. 아키텍처 설계 결정, 메시지 전달 흐름, 상태 관리, 동시성 제어 등 구현 전반을 다룬다.

### 1.2. 시스템 사양

| 항목 | 값 |
|------|-----|
| 네임스페이스 | `/chat/ws` |
| 전송 프로토콜 | WebSocket |
| 직렬화 | FlatBuffers (메시지 데이터), JSON (제어 이벤트) |
| 인증 | 핸드셰이크 미들웨어 (연결 시 1회) |
| 크로스 Pod 동기화 | ShardedPubSub 알림 + Redis ZSET Pull |
| 서비스 포트 | 3007 (`apps/chat-service`) |

### 1.3. 핵심 상수

| 상수 | 값 | 용도 |
|------|-----|------|
| `MAX_PULL_COUNT` | 200 | Pub/Sub 알림 수신 시 ZSET에서 1회 최대 pull 건수 |
| `DEFAULT_HISTORY_LIMIT` | 50 | `get_history` 기본 조회 건수 |
| `maxMessagesPerRoom` | 500 (설정) | 방당 ZSET 최대 보관 메시지 수 |
| `maxContentLength` | 2000 (설정) | 메시지 content 최대 길이 |
| `FB_BUILDER_SIZE_SMALL` | 512 | FlatBuffers Builder 초기 버퍼 (단일 메시지) |
| `FB_BUILDER_SIZE_LARGE` | 1024 | FlatBuffers Builder 초기 버퍼 (다건) |

---

## 2. 설계 원칙

### 2.1. 알림 + Pull 하이브리드 모델

메시지 데이터를 Pub/Sub으로 직접 전송하지 않는다. Pub/Sub은 **경량 알림(~30B, roomId만)**만 전파하고, 수신 Pod가 Redis ZSET에서 데이터를 **pull**한다.

**근거**: Pub/Sub 페이로드 최소화, 알림 유실 시 자가 복구, 방 수에 무관한 고정 구독 수 유지.

### 2.2. 단일 전달 경로

send/edit/delete의 결과 메시지는 ack에 포함하지 않는다. 모든 메시지 데이터는 Pub/Sub → ZSET Pull → `new_messages` 이벤트라는 **단일 경로**로만 전달된다.

**근거**: 발신자가 ack과 `new_messages`에서 동일 메시지를 이중 수신하는 문제를 원천 차단.

### 2.3. 채널 분리

`MessageService.persistAndNotify()`는 `channel` 파라미터(`'sse' | 'socket'`)에 따라 해당 전송 모듈의 이벤트만 발행한다.

| 호출자 | channel | 발행 이벤트 | 채널 접두사 |
|--------|---------|------------|-----------|
| ChatGateway (Socket.IO) | `'socket'` | `CHAT_SOCKET_NOTIFY` | `chat:ws:shard:` |

### 2.4. 개별 이벤트 패턴

프로젝트 내 다른 게이트웨이(Matchcore, Merge Scandal)는 단일 이벤트 + 내부 라우팅 패턴을 사용하지만, Chat Service는 **이벤트별 독립 핸들러** 패턴을 채택한다.

| 비교 항목 | 게임 게이트웨이 | Chat 게이트웨이 |
|----------|--------------|---------------|
| 이벤트 수 | 수십~수백 개의 게임 액션 | 6개 고정 |
| 라우팅 | `RequestPackage` → 내부 dispatcher | 이벤트명 = 핸들러 |
| 확장성 | union type 추가로 무제한 | 도메인상 고정 |

채택 이유:
- 연산 6개 고정, 확장 가능성 낮음
- NestJS 데코레이터(`@SubscribeMessage`, `ParseFlatBuffer`)와 자연스러운 조합
- 이벤트명이 곧 API 명세 → 디버깅 용이

### 2.5. Redis Adapter를 사용하지 않는 이유

`@socket.io/redis-adapter`(Sharded 모드)는 **방별 동적 Redis 채널**을 생성한다. 방 수에 비례하여 구독 수와 churn(빈번한 subscribe/unsubscribe)이 증가하며, Redis 싱글스레드에 상태 변경 부하를 유발한다.

**비교 분석 (10 Pod, 100K 방, 10K msg/s 기준):**

| 항목 | Redis Adapter (Sharded) | ShardedPubSub + Pull |
|------|------------------------|---------------------|
| Pub/Sub 구독 수 | 200,000 (방별 동적) | 앱당 N개 (설정값, 기본 10) |
| 구독 churn | ~1,000/s | 앱 연결/해제 시에만 |
| Pub/Sub payload | ~1KB (전체 데이터) | ~30B (roomId만) |
| 추가 Redis 쿼리 | 0 | Pod당 ~2K/s (ZRANGEBYSCORE) |
| 페일오버 재구독 | 수만 개 (수 초) | 앱당 N개 (ms) |
| Pod당 Redis 연결 | 4개 | 2개 |
| 비용 비례 | 방 수에 비례 | 메시지 수에 비례 |
| 동시 알림 중복 emit | 없음 | roomQueue로 방지 |

**트레이드오프**: 메시지당 ~1ms의 추가 지연(Redis RTT)이 발생하지만, 구독 관리 비용 제거, 페일오버 ms급 복구, Redis 연결 절약이 이를 상회한다.

**롤백 경로**: `redis-io.adapter.ts`를 삭제하지 않고 유지한다. Push 모델로 롤백 시 `main.ts`에서 `RedisIoAdapter`를 장착하면 된다.

---

## 3. 시스템 아키텍처

### 3.1. 컴포넌트 구성도

```
Client (Game App / Web)
  │
  │ Socket.IO WebSocket
  │ namespace: /chat/ws
  │ transport: websocket
  ▼
+-----------------------------------------------------------+
│                    Chat Service (:3007)                    │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ChatGateway (/chat/ws)                               │  │
│  │  send_message / edit_message / delete_message        │  │
│  │  get_history / join_room / leave_room                │  │
│  └──────────┬───────────────────────────────────────────┘  │
│             │                                              │
│             ▼                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              MessageService                          │  │
│  │  - send / edit / delete                              │  │
│  │  - persistAndNotify (ZSET 저장 + EventEmitter emit)  │  │
│  │  - getHistory / getEventsSince                       │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │ CHAT_SOCKET_NOTIFY               │
│                         ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ SocketConnectionService (@OnEvent 리스너)             │  │
│  │  1. ShardedPubSub.publish(shard, roomId)             │  │
│  │  2. 알림 수신 → 로컬 Room 체크 → ZSET pull → emit    │  │
│  └─────────┬────────────────────────────────────────────┘  │
│            │                                               │
│            │  ShardedPubSubService (앱별 N개 고정 샤드)     │
│            ▼  (cross-pod 경량 알림, roomId만 전파)         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Redis Pub/Sub (chat:ws:shard:0..N-1)                │  │
│  │  + Redis ZSET (메시지 데이터 pull)                    │  │
│  └──────────────────────────────────────────────────────┘  │
+-----------------------------------------------------------+
```

### 3.2. 알림 경로 분리

```
MessageService.persistAndNotify(channel)
  ├── ZADD (Redis ZSET 저장)
  └── channel에 따라 하나만 발행:
        ├── 'sse'    → EventEmitter.emit(CHAT_SSE_NOTIFY)
        │                └── SseConnectionService → ShardedPubSub → cross-pod dirty → BatchService
        └── 'socket' → EventEmitter.emit(CHAT_SOCKET_NOTIFY)
                         └── SocketConnectionService → ShardedPubSub → cross-pod 알림 → ZSET pull → 로컬 emit
```

### 3.3. 멀티 Pod 구성도

```
[Pod A]                              [Pod B]
ChatGateway                          ChatGateway
  │ client.join("lobby")               │ client.join("lobby")
  │                                    │
SocketConnectionService              SocketConnectionService
  │ @OnEvent → publish(shard, roomId)  │ subscribe(shard) → 알림 수신
  │                                    │
  ├── ShardedPubSub ──── Redis ──── ShardedPubSub ──┤
  │  chat:ws:shard:{idx}                            │
  │  (~30B 알림, roomId만)                           │
  │                                    │
  ├── rooms.get("lobby")? Y            ├── rooms.get("lobby")? Y
  ├── roomLastFlushed 확인              ├── roomLastFlushed 확인
  ├── ZRANGEBYSCORE (pull)             ├── ZRANGEBYSCORE (pull)
  ├── buildMessageBatch()              ├── buildMessageBatch()
  └── server.to().emit() (로컬만)      └── server.to().emit() (로컬만)
       │                                    │
       ▼                                    ▼
  Pod A의 소켓 수신                    Pod B의 소켓 수신
```

---

## 4. 연결 및 인증

### 4.1. 인증 흐름

Socket.IO 핸드셰이크 시 `afterInit()`에서 등록한 미들웨어가 인증을 수행한다. 인증이 완료되기 전에 연결이 수립되지 않으므로, 인증되지 않은 소켓은 존재하지 않는다.

```
클라이언트 → Socket.IO 핸드셰이크
     │
     ├── 1. Bearer 토큰 추출
     │     └── extractSocketBearerToken()
     │     └── 실패 → next(Error) → connect_error
     │
     ├── 2. JWT 검증
     │     └── verifyJwtToken(token, secret) (로컬 검증, gRPC 호출 없음)
     │     └── 실패 → next(Error) → connect_error
     │
     └── 3. 성공 → socket.data에 저장
               └── userId (JWT payload)
```

### 4.2. 인증 헤더

| 헤더 | 필수 | 전달 방식 | 설명 |
|------|:---:|----------|------|
| `Authorization` | O | `auth.token` | `Bearer {JWT}` |

### 4.3. 인증 실패 에러

| 상황 | 에러 메시지 |
|------|------------|
| 토큰 누락 | `Authorization token is required` |
| JWT 만료/무효 | `Invalid or expired token` |

### 4.4. socket.data 구조

```typescript
interface ChatSocketData {
  userId: string;           // JWT에서 추출한 사용자 ID
  joinedRooms?: string[];   // disconnecting 이벤트에서 캡처한 rooms
}
```

### 4.5. 연결 코드 예시

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3007/chat/ws', {
  auth: { token: `Bearer ${jwtToken}` },
  transports: ['websocket'],
});
```

---

## 5. 이벤트 인터페이스

### 5.1. Client → Server

| 이벤트 | 페이로드 | 응답 방식 | 방 참여 필요 | 설명 |
|--------|----------|-----------|:---:|------|
| `join_room` | JSON | ack `{ success, error? }` + catch-up `new_messages` | - | 방 참여 |
| `leave_room` | JSON | ack `{ success, error? }` | - | 방 퇴장 |
| `send_message` | FlatBuffers `Buffer` | ack `{ success, error? }` | O | 메시지 전송 |
| `edit_message` | FlatBuffers `Buffer` | ack `{ success, error? }` | O | 메시지 수정 |
| `delete_message` | FlatBuffers `Buffer` | ack `{ success, error? }` | O | 메시지 삭제 |
| `get_history` | FlatBuffers `Buffer` | `history_response` 이벤트 | O | 히스토리 조회 |

### 5.2. Server → Client

| 이벤트 | 페이로드 | 설명 |
|--------|----------|------|
| `new_messages` | `(roomId: string, Buffer)` — `MessageBatch` | 실시간 메시지 푸시 (send/edit/delete 결과) |
| `history_response` | `Buffer` — `HistoryResponse` | 히스토리 조회 응답 |
| `error` | `{ message: string }` (JSON) | 에러 알림 |

### 5.3. 페이로드 형식 분류

| 구분 | 이벤트 | 요청 | 응답 |
|------|--------|------|------|
| 데이터 변경 | send/edit/delete | FlatBuffers Buffer | JSON ack + `new_messages` (Pub/Sub → Pull) |
| 조회 | get_history | FlatBuffers Buffer | FlatBuffers Buffer (`history_response` 이벤트) |
| 제어 | join_room/leave_room | JSON | JSON ack |

### 5.4. FlatBuffers 스키마

```fbs
namespace Chat;

enum MessageStatus : byte { NORMAL = 0, EDITED = 1, DELETED = 2 }

table ChatMessage {
  id:string;
  status:MessageStatus;
  sender_id:string;
  content:string;
  metadata:string;
  timestamp:long;          // 서버 저장 시각 (Unix ms)
  event_timestamp:long;    // 이벤트 정렬용 (마이크로초)
}

table SendMessageRequest {
  room_id:string;
  content:string;
  metadata:string;
}

table EditMessageRequest {
  room_id:string;
  message_id:string;
  content:string;
}

table DeleteMessageRequest {
  room_id:string;
  message_id:string;
}

table HistoryRequest {
  room_id:string;
  limit:int;              // 기본 50, 최대 500
  before:string;          // 페이지네이션 커서 (eventTimestamp)
}

table MessageBatch {
  messages:[ChatMessage];
  latest_event_timestamp:long;
}

table HistoryResponse {
  messages:[ChatMessage];
  latest_event_timestamp:long;
  has_more:bool;
}
```

### 5.5. 이벤트별 상세

#### `join_room`

| 항목 | 값 |
|------|-----|
| 요청 | `{ roomId: string, lastTimestamp?: number }` (JSON) |
| 응답 | ack `{ success: true }` |
| 부가 응답 | `lastTimestamp` 제공 + 밀린 메시지 존재 시 `new_messages` 이벤트 |
| 중복 호출 | 이미 참여 중이면 catch-up 없이 `{ success: true }` 즉시 반환 |
| roomId 검증 | 빈 값, `:` 포함 시 `{ success: false, error: 'Invalid roomId' }` |

#### `leave_room`

| 항목 | 값 |
|------|-----|
| 요청 | `{ roomId: string }` (JSON) |
| 응답 | ack `{ success: true }` |
| 미참여 방 | 에러 없이 `{ success: true }` (no-op) |
| 내부 동작 | `await client.leave(roomKey)` 완료 후 `cleanupRoom()` |

#### `send_message`

| 항목 | 값 |
|------|-----|
| 요청 | FlatBuffers `SendMessageRequest` |
| 응답 | ack `{ success: true }` (메시지 데이터 미포함) |
| 메시지 전달 | Pub/Sub → ZSET pull → `new_messages` (방 전체) |
| 검증 | roomId 필수, content 필수 (1~2000자) |

#### `edit_message`

| 항목 | 값 |
|------|-----|
| 요청 | FlatBuffers `EditMessageRequest` |
| 응답 | ack `{ success: true }` |
| 메시지 전달 | `new_messages`로 `ChatMessage.status = EDITED(1)` 전달 |

#### `delete_message`

| 항목 | 값 |
|------|-----|
| 요청 | FlatBuffers `DeleteMessageRequest` |
| 응답 | ack `{ success: true }` |
| 메시지 전달 | `new_messages`로 `ChatMessage.status = DELETED(2)`, content 빈 문자열 |

#### `get_history`

| 항목 | 값 |
|------|-----|
| 요청 | FlatBuffers `HistoryRequest` |
| 응답 | `history_response` 이벤트 (ack 아님) |
| 페이지네이션 | `before` (eventTimestamp 커서) + `limit` + `has_more` |

---

## 6. 메시지 전달 흐름

### 6.1. send_message 전체 플로우

```
User A: send_message (FlatBuffers Buffer)
     │
     ▼
ChatGateway.handleSendMessage()
     │
     ├── ParseFlatBuffer pipe → ParsedSendRequest
     │
     ├── MessageService.send(channel='socket')
     │     ├── Redis ZADD (FlatBuffers 바이너리 저장)
     │     └── EventEmitter.emit(CHAT_SOCKET_NOTIFY, { roomId })
     │
     └── return { success: true }  ← User A에 ack 응답 (메시지 데이터 없음)

                    ┌── CHAT_SOCKET_NOTIFY (in-process)
                    ▼
SocketConnectionService (@OnEvent 리스너)
     │
     ├── ShardedPubSub.publish(shard, roomId)  ← ~30B 알림만
     │
     │   ┌── 해당 앱의 샤드를 구독 중인 모든 Pod가 알림 수신
     │   ▼
     ├── 로컬 Room 존재? (server.adapter.rooms.has)
     │     └── N: 무시
     │     └── Y: roomLastFlushed 확인
     │           ├── undefined: 현재 시각으로 초기화 + skip (안전 fallback)
     │           └── 값 존재: ZSET에서 since 이후 pull → emit + ts 갱신
     │
     ▼
User A & B: 'new_messages' 이벤트 수신 (단일 전달 경로, 중복 없음)
```

### 6.2. join_room catch-up 플로우

클라이언트가 `lastTimestamp`를 전달하면 밀린 메시지를 즉시 전송하고, `roomLastFlushed`를 갱신하여 이후 Pub/Sub 알림과의 중복 pull을 방지한다.

```
Client: join_room { roomId: "lobby", lastTimestamp: 1712345678000 }
     │
     ▼
ChatGateway.handleJoinRoom()
     ├── roomId 검증 (빈 값, ':' 포함 불가)
     ├── client.rooms.has("lobby")? → Y: return { success: true } (중복 join)
     ├── client.join("lobby")             ← Socket.IO 네이티브 Room
     ├── messageService.getEventsSince("lobby", lastTimestamp)
     ├── events.length > 0 ?
     │     ├── Y: updateRoomLastFlushed(roomKey, latestTs) + emit catch-up
     │     └── N: initRoomLastFlushed(roomKey) ← 현재 시각으로 초기화
     ├── lastTimestamp 없이 join → initRoomLastFlushed(roomKey)
     └── return { success: true }
```

---

## 7. 방 관리

### 7.1. Socket.IO 네이티브 Room

수동 Map 관리 없이 Socket.IO의 네이티브 Room 기능을 사용한다.

| 동작 | API | 설명 |
|------|-----|------|
| 방 참여 | `client.join(roomKey)` | Socket.IO가 Room 멤버십 관리 |
| 방 퇴장 | `await client.leave(roomKey)` | 어댑터 완료 대기 후 `cleanupRoom()` |
| 연결 해제 | 자동 | Socket.IO가 모든 Room에서 자동 제거 + `cleanupRoom()` |
| 브로드캐스트 | `server.to(roomKey).emit(...)` | 로컬 Pod 소켓에만 전송 (in-memory adapter) |

**Room 키 형식**: `{roomId}` (예: `lobby`)

### 7.2. 연결 해제 시 Room 정리

`disconnecting` 이벤트에서 `client.rooms`를 캡처하여 `socket.data.joinedRooms`에 저장한다. Socket.IO의 `disconnect` 시점에는 `rooms`가 이미 비어 있을 수 있으므로, 캡처한 목록을 기반으로 `cleanupRoom()`을 수행한다.

### 7.3. `cleanupRoom()` 동작

Room에 소켓이 남아있지 않으면 `roomLastFlushed`에서 해당 키를 삭제한다. 소켓이 남아있으면 아무 동작도 하지 않는다 (동일 유저의 멀티 소켓 시나리오 대응).

---

## 8. 크로스 Pod 동기화

### 8.1. ShardedPubSub 동작 원리

1. 메시지 저장 후 `SocketConnectionService`가 **경량 알림**(~30B, roomId만)을 발행
2. 모든 Pod가 N개 샤드 채널(`chat:ws:shard:0..N-1`)을 고정 구독 중
3. 알림 수신 시 `server.adapter.rooms.get(roomKey)`로 로컬 Room 존재 여부를 O(1) 체크
4. 로컬 Room이 있으면 `roomLastFlushed`에 따라 분기:
   - `undefined`: 현재 시각 초기화 + skip (안전 fallback)
   - 값 존재: `ZRANGEBYSCORE ... LIMIT 0 200`으로 pull + emit + ts 갱신
5. FlatBuffers `MessageBatch`로 직렬화하여 `server.to(roomKey).emit()`

### 8.2. 구독 관리

Pod 시작 시 모든 N개 샤드 채널(`chat:ws:shard:0..N-1`)을 구독하고, Pod 종료 시 해지한다.

| 시점 | 동작 |
|------|------|
| 모듈 초기화 | `subscribeAll()` — N개 샤드 채널 전체 구독 |
| 모듈 종료 | `unsubscribeAll()` — N개 샤드 채널 전체 해지 |

동적 subscribe/unsubscribe 없이 고정 구독을 유지하므로 구독 관리 부하와 race condition이 없다.

### 8.3. 샤드 해싱 — DJB2 + MurmurHash3 fmix32

`roomId` 문자열을 DJB2로 해싱한 뒤, MurmurHash3의 fmix32 finalizer를 적용하여 샤드 인덱스를 계산한다.

```typescript
function shardIndex(roomId: string, shardCount: number): number {
  let h = 0;
  for (let i = 0; i < roomId.length; i++) {
    h = ((h << 5) - h + roomId.charCodeAt(i)) | 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) % shardCount;
}
```

DJB2 단독 사용 시 순차적 키(`room-1`, `room-2`)에서 해시 분포가 편중되는 문제가 있어 fmix32를 추가했다. fmix32는 입력 비트의 작은 변화가 출력 비트 전체에 골고루 퍼지는 **avalanche 효과**를 제공한다. 비용은 ~100 정수 연산(수십 나노초)으로 네트워크 I/O 대비 무시할 수준이다.

채널 접두사: `chat:ws:shard:{index}`

### 8.4. Redis 연결 구성

| 용도 | 클라이언트 | 관리 주체 |
|------|-----------|----------|
| ZADD, ZRANGEBYSCORE 등 명령 | commandClient | `libs/dao/src/redis/chat/redis-cluster.module.ts`의 `CHAT_REDIS_COMMAND_CLIENT` |
| ShardedPubSub (Socket.IO) | pubsubClient | `libs/dao/src/redis/chat/redis-cluster.module.ts`의 `CHAT_REDIS_PUBSUB_CLIENT` |

두 클라이언트 모두 `ioredis` 인스턴스이며 `CHAT_REDIS_DB_NUMBER` 환경변수로 지정한 DB에 연결한다. Pod당 Redis 연결: 2개. Redis Cluster 모드 사용 시 `SSUBSCRIBE`/`SPUBLISH`로 교체한다.

---

## 9. 상태 관리

`SocketConnectionService`가 관리하는 Pod-local 상태이다. Redis에 저장하지 않으며, Pod 재시작 시 초기화된다.

### 9.1. 상태 목록

| 상태 | 타입 | 키 | 역할 |
|------|------|----|------|
| `roomLastFlushed` | `Map<string, number>` | `roomId` | 마지막으로 emit한 메시지의 `eventTimestamp` (마이크로초) |
| `roomQueue` | `Map<string, Promise>` | `roomId` | 방별 직렬 실행 큐 (동시 알림 중복 방지) |

### 9.2. `roomLastFlushed` 생명주기

| 단계 | 시점 | 동작 |
|------|------|------|
| 초기화 | `join_room` | catch-up 이벤트 있으면 최신 `eventTimestamp`, 없으면 `Date.now() * 1000` |
| 갱신 | ZSET pull 성공 | 가져온 메시지 중 최대 `eventTimestamp`로 갱신 (기존값보다 큰 경우만) |
| 정리 | `leave_room` / disconnect | 해당 Room이 비면 `cleanupRoom()`에서 삭제 |

**초기화 메서드**:
- `initRoomLastFlushed(roomKey)` — 아직 값이 없을 때만 `Date.now() * 1000`으로 설정
- `updateRoomLastFlushed(roomKey, ts)` — 기존 값보다 큰 경우에만 갱신

**안전 fallback**: `onShardMessage`에서 `roomLastFlushed`가 `undefined`이면 현재 시각으로 초기화하고 해당 알림은 skip한다 (메시지 조회 없이 중복 수신 방지).

**자가 복구(self-healing)**: Pub/Sub 알림이 유실되더라도 다음 알림 시 `roomLastFlushed` 이후의 모든 메시지를 pull하므로 데이터 손실이 없다.

---

## 10. 동시성 제어

### 10.1. 방별 처리 큐 (roomQueue)

같은 방에 대한 Pub/Sub 알림이 짧은 간격으로 연속 도착하면 `onShardMessage`가 동시에 실행되어 중복 emit이 발생할 수 있다. **방별 Promise chain 큐**로 같은 방의 `onShardMessage`를 직렬 실행한다.

```typescript
private enqueueShardMessage(roomId: string): void {
  const prev = this.roomQueue.get(roomId) ?? Promise.resolve();
  const next = prev
    .then(() => this.onShardMessage(roomId))
    .catch(() => {})
    .finally(() => {
      if (this.roomQueue.get(roomId) === next) {
        this.roomQueue.delete(roomId);
      }
    });
  this.roomQueue.set(roomId, next);
}
```

**동작 특성**:
- 같은 방: 이전 처리 완료 후 순차 실행
- 다른 방: 병렬 실행 (간섭 없음)
- 마지막 Promise 완료 시 Map 엔트리 자동 삭제 (메모리 누수 방지)

**큐 도입 전후 비교**:

```
큐 없이 동시 실행 (이전):
  알림1: since=100 → pull [A(200)] → emit [A]
  알림2: since=100 → pull [A(200), B(300)] → emit [A, B]  ← A 중복

큐로 직렬 실행 (현재):
  알림1: since=100 → pull [A(200)] → emit [A] → set(200)
  알림2: (알림1 완료 후) since=200 → pull [B(300)] → emit [B]  ← 정확히 1번씩
```

**비용**: 같은 방의 연속 알림에 ~1ms(Redis RTT) 직렬화 지연이 추가되지만, 중복 `ZRANGEBYSCORE` 쿼리가 제거되어 Redis 부하가 감소한다.

---

## 11. 에러 처리

### 11.1. 에러 경로 분류

| 이벤트 | 에러 전달 방식 | 처리 주체 |
|--------|--------------|----------|
| send/edit/delete | ack `{ success: false, error }` | 핸들러 내 try/catch |
| join_room/leave_room | ack `{ success: false, error }` | 핸들러 내 직접 반환 |
| get_history | `error` 이벤트 | `WsFlatBufferResponseInterceptor` catchError |
| 미포착 에러 (전체) | `error` 이벤트 | `WsFlatBufferResponseInterceptor` catchError |

### 11.2. send/edit/delete 에러

방 참여 여부를 먼저 확인하고, 미참여 시 ack으로 에러를 반환한다. 비즈니스 에러는 try/catch로 포착하여 ack 반환, 미포착 에러는 인터셉터가 `error` 이벤트로 전달한다.

```typescript
if (!client.rooms.has(roomKey)) {
  return { success: false, error: 'join_room required' };
}

```

### 11.3. get_history 에러

ack이 아닌 `@WsResponseEvent` 경로를 사용하므로, `throw new Error()`로 던진 에러는 인터셉터의 `catchError`에서 포착되어 `error` 이벤트로 전송된다.

### 11.4. join_room / leave_room 에러

`@WsResponseEvent` 메타데이터가 없으므로 인터셉터의 `!event` 분기를 탄다. 정상 경로에서는 JSON ack을 직접 반환하고, 예기치 못한 에러만 인터셉터가 `error` 이벤트로 전달한다.

### 11.5. 에러 메시지 목록

#### ack 에러 (`{ success: false, error }`)

| 에러 메시지 | 발생 조건 |
|------------|----------|
| `join_room required` | 방 미참여 상태에서 send/edit/delete 시도 |
| `Invalid roomId` | roomId 빈 값 또는 `:` 포함 |
| `content is required` | content 빈 값 |
| `content exceeds max length` | content 2000자 초과 |

#### error 이벤트

| 에러 메시지 | 발생 조건 |
|------------|----------|
| `join_room required before querying history` | 방 미참여 상태에서 get_history 시도 |
| `Request body must be a Buffer` | FlatBuffers 바이너리가 아닌 데이터 전송 |

---

## 12. NestJS 구현 패턴

HTTP REST 컨트롤러 패턴(`FlatbufferResponseInterceptor`, `ParseFlatBuffer`, `Serialized<T>`)을 WebSocket 환경에 맞게 별도 구현했다.

### 12.1. WsFlatBufferResponseInterceptor

핸들러가 `Buffer`를 반환하면 `Reflector`로 읽은 이벤트명으로 자동 `emit`하고, NestJS 기본 응답을 억제한다.

```typescript
@Injectable()
export class WsFlatBufferResponseInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const event = this.reflector.get<BufferResponseEvent>(WS_RESPONSE_EVENT, ctx.getHandler());
    const client = ctx.switchToWs().getClient<ChatSocket>();

    const emitError = (err: unknown) => {
      client.emit('error', { message: err instanceof Error ? err.message : 'Unknown error' });
      return EMPTY;
    };

    if (!event) return next.handle().pipe(catchError(emitError));

    return next.handle().pipe(
      tap((data) => { if (Buffer.isBuffer(data)) client.emit(event, data); }),
      map(() => undefined),   // NestJS 기본 ack 응답 억제
      catchError(emitError),
    );
  }
}
```

| 분기 | 대상 핸들러 | 동작 |
|------|-----------|------|
| `event` 있음 | `get_history` | Buffer → `client.emit(event, buffer)` → NestJS에 `undefined` 반환 |
| `event` 없음 | send/edit/delete, join/leave | `catchError`만 적용 (미포착 에러 → `error` 이벤트) |

### 12.2. @WsResponseEvent 데코레이터

핸들러에 emit할 이벤트명을 선언적으로 지정한다.

```typescript
@SubscribeMessage('get_history')
@WsResponseEvent('history_response')
async handleGetHistory(...): Promise<Serialized<HistoryResponseT>> {
  // Buffer 반환 → 인터셉터가 client.emit('history_response', buffer)
}
```

### 12.3. 파라미터 데코레이터

핸드셰이크 미들웨어가 `socket.data`에 저장한 인증 정보를 추출한다.

| 데코레이터 | 추출 대상 | HTTP 대응 |
|-----------|----------|----------|
| `@SocketUser()` | `socket.data.userId` | `@AuthUser()` |

### 12.4. ParseFlatBuffer 재사용

HTTP 컨트롤러용 `ParseFlatBuffer` mixin pipe를 Socket.IO Gateway에서도 동일하게 사용한다.

```typescript
// HTTP
@Body(ParseFlatBuffer('parseSendRequest')) parsed: ParsedSendRequest

// Socket.IO (동일)
@MessageBody(ParseFlatBuffer('parseSendRequest')) parsed: ParsedSendRequest
```

### 12.5. 타입 안전성 — BufferResponseEvent

`ServerToClientEvents`에서 `(payload: Buffer) => void` 시그니처를 가진 이벤트 키만 추출한다.

```typescript
export type BufferResponseEvent = {
  [K in keyof ServerToClientEvents]: ServerToClientEvents[K] extends (
    payload: Buffer,
  ) => void ? K : never;
}[keyof ServerToClientEvents];
// 결과: 'history_response' (new_messages는 2인자, error는 JSON이므로 제외)
```

### 12.6. HTTP vs Socket.IO 패턴 대조표

| 관심사 | HTTP (MessageController) | Socket.IO (ChatGateway) |
|--------|-------------------------|------------------------|
| 요청 파싱 | `@Body(ParseFlatBuffer('...'))` | `@MessageBody(ParseFlatBuffer('...'))` |
| 사용자 추출 | `@AuthUser()` | `@SocketUser()` |
| send/edit/delete 응답 | `FlatbufferResponseInterceptor` → `StreamableFile` | JSON ack `{ success }` |
| get_history 응답 | `FlatbufferResponseInterceptor` → `StreamableFile` | `WsFlatBufferResponseInterceptor` → `client.emit()` |
| 에러 처리 | `BadRequestException` → HTTP 400 | ack `{ success: false, error }` + 인터셉터 `client.emit('error')` |

---

## 13. 모듈 구조 및 디렉터리

본 서비스는 NestJS 모노레포(`public-server`)의 신규 애플리케이션으로 추가된다. 기존 `@libs/auth`, `@libs/dao`, `@libs/common` 라이브러리를 재활용한다.

### 13.1. 모노레포 위치

```
public-server/
├── apps/
│   ├── identity/         (기존)
│   ├── payment/          (기존)
│   └── chat-service/     (신규, 포트 3007)
├── libs/
│   ├── auth/             (JWT, ApiKey 전략, AuthService — 재활용)
│   ├── common/           (ResponseEntity, Logger, AbstractRedisRepository — 재활용)
│   └── dao/
│       └── redis/
│           └── chat/     (ZSET 레포지토리 + RedisClusterModule 신규 추가)
```

`nest-cli.json`에 `chat-service` 엔트리를 추가하며, `tsconfig.paths.json`은 변경하지 않는다 (기존 `@libs/*` alias 그대로 사용).

### 13.2. ChatModule 의존관계

```
ChatModule (apps/chat-service/src/chat.module.ts)
├── imports
│   ├── ChatServerConfig          (env 로딩)
│   ├── ClsModule
│   ├── RedisClusterModule        (@libs/dao/redis/chat — command/pubsub 클라이언트 2종)
│   ├── FlatBuffersModule         (스키마 빌더/파서)
│   ├── MessageModule             (MessageService, ZSET 저장)
│   ├── PubSubModule              (ShardedPubSubService)
│   └── SocketModule              (ChatGateway, SocketConnectionService)
```

### 13.3. SocketModule 의존관계

```
SocketModule (apps/chat-service/src/socket/socket.module.ts)
├── imports
│   ├── FlatBuffersModule         (ParseFlatBuffer pipe, builders)
│   ├── MessageModule             (MessageService — ZSET pull)
│   └── PubSubModule              (ShardedPubSubService — cross-pod 알림)
├── providers
│   ├── ChatGateway               (Socket.IO 게이트웨이)
│   ├── SocketConnectionService   (ShardedPubSub 리스너 + ZSET pull + 로컬 emit)
│   └── { provide: APP_INTERCEPTOR, useClass: WsFlatBufferResponseInterceptor }
└── exports
    └── SocketConnectionService
```

### 13.4. 디렉터리 구조

```
apps/chat-service/
├── schemas/
│   └── chat.fbs                                       # FlatBuffers 스키마 원본
├── src/
│   ├── main.ts                                        # NestFactory.create(ChatModule)
│   ├── chat.server.ts                                 # Swagger + listen(3007)
│   ├── chat.module.ts                                 # 루트 모듈
│   ├── config/
│   │   └── chat-server-config.ts                      # ConfigModule + .chat.${env}.env
│   ├── socket/
│   │   ├── chat.gateway.ts                            # Socket.IO 게이트웨이 (네이티브 Room)
│   │   ├── socket-connection.service.ts               # ShardedPubSub + ZSET pull + 로컬 emit
│   │   ├── socket.module.ts
│   │   ├── adapters/
│   │   │   └── redis-io.adapter.ts                    # [미사용] Push 모델 롤백 대비 유지
│   │   ├── auth/
│   │   │   └── socket-auth.middleware.ts              # 핸드셰이크 미들웨어 (JWT 검증)
│   │   ├── decorators/
│   │   │   ├── socket-params.decorator.ts             # @SocketUser
│   │   │   └── ws-response-event.decorator.ts         # @WsResponseEvent
│   │   ├── interceptors/
│   │   │   └── ws-flatbuffer-response.interceptor.ts  # Buffer → emit 자동 변환 + 에러 처리
│   │   └── interfaces/
│   │       └── socket-connection.interface.ts         # ChatSocketData, ServerToClientEvents 등
│   ├── message/
│   │   ├── message.service.ts                         # send/edit/delete/getHistory/getEventsSince
│   │   ├── message.module.ts
│   │   └── message.constants.ts                       # CHAT_SOCKET_NOTIFY, DEFAULT_HISTORY_LIMIT
│   ├── pubsub/
│   │   ├── sharded-pubsub.service.ts                  # 앱별 N개 샤드 구독/발행
│   │   ├── pubsub.module.ts
│   │   └── pubsub.constants.ts                        # SHARD_COUNT_DEFAULT = 10
│   └── flatbuffers/
│       ├── generated/                                 # flatc 산출물 (커밋)
│       ├── parse-flatbuffer.pipe.ts                   # ParseFlatBuffer mixin pipe
│       ├── builders.ts                                # buildChatMessage, buildMessageBatch 등
│       ├── flatbuffers.module.ts
│       └── index.ts
└── test/
    ├── jest-e2e.json
    └── unit.spec.ts
```

### 13.5. @libs 재활용 매핑

| 신규 컴포넌트 | 재활용 대상 | 비고 |
|--------------|-----------|------|
| `socket-auth.middleware` | `process.env.ACCESS_TOKEN_SECRET` + `jsonwebtoken` | `@libs/auth` JwtStrategy와 동일한 시크릿으로 로컬 검증 (gRPC 호출 없음). |
| `RedisClusterModule` | `@libs/dao/src/config/redis/redis.config.ts` | 기존 redis config 재사용, `CHAT_REDIS_DB_NUMBER` 분리. |
| `MessageService` | `@libs/dao/redis/chat/repositories/redis-chat-zset.repository.ts` | 신규 ZSET 레포지토리. 기존 `RedisChatRepository` (lpush/hset)는 레거시 게이트웨이 제거 후 함께 정리. |
| `ChatModule` 공통 인프라 | `@libs/common` `ResponseEntity`, `ClsModule`, `Logger` | identity/payment와 동일한 패턴. |

### 13.6. 신규/변경되는 @libs/dao 파일

```
libs/dao/src/redis/chat/
├── redis-cluster.module.ts                # 신규: commandClient + pubsubClient
├── repositories/
│   ├── redis-chat.repository.ts           # 레거시 (legacy ChatGateway 제거 시 평가)
│   └── redis-chat-zset.repository.ts      # 신규: ZADD/ZRANGEBYSCORE/ZREMRANGEBYRANK
├── keys.ts                                # 신규: ZSET key + 샤드 채널 helpers
├── hash.ts                                # 신규: DJB2 + fmix32 shardIndex
└── redis-chat.module.ts                   # RedisClusterModule + 두 레포 export
```

### 13.7. 레거시 ChatGateway 제거

기존 `libs/common/src/gateway/chat.gateway.ts`는 `lpush` 기반 단일 Pod 구현으로 본 명세서와 모델이 다르다. 신규 `apps/chat-service` 빌드 후 다음 단계로 제거한다:

1. `apps/identity/src/identity.module.ts`에서 `ChatGateway` provider 및 import 제거
2. `apps/identity/src/main.ts`에서 `AuthenticatedRedisIoAdapter` 장착 코드 제거
3. `libs/common/src/gateway/chat.gateway.ts` 삭제
4. `libs/common/src/adapter/authenticated-redis-io.adapter.ts`는 `apps/chat-service/src/socket/adapters/redis-io.adapter.ts`로 이전 후 원본 삭제 (Push 모델 롤백 대비)
5. `RedisChatRepository`는 외부 의존 grep 결과에 따라 잔존/제거 결정

---

## 14. 운영

### 14.1. Graceful Shutdown

```
app.enableShutdownHooks()
     │
     ├── SocketConnectionService.onModuleDestroy()
     │     ├── 모든 샤드 채널 unsubscribe (Promise.allSettled)
     │     ├── roomLastFlushed.clear()
     │     └── roomQueue.clear()
     │
     └── Socket.IO 서버 연결 종료 (NestJS 어댑터 처리)
```

`Promise.allSettled`로 해지하여 개별 unsubscribe 실패가 다른 채널의 정리를 차단하지 않는다. Room 멤버십은 Socket.IO가 관리하며 연결 해제 시 자동 정리된다.

### 14.2. 모니터링 포인트

| 항목 | 확인 방법 | 이상 징후 |
|------|----------|----------|
| roomLastFlushed Map 크기 | 메모리 모니터링 | 방 퇴장 후에도 계속 증가 → cleanupRoom 누락 |
| roomQueue Map 크기 | 메모리 모니터링 | 지속적 증가 → onShardMessage 지연/hang |
| Redis ZRANGEBYSCORE 빈도 | Redis 모니터링 | Pod당 ~2K/s 초과 → 알림 폭주 또는 큐 미작동 |
| Pod당 Redis 연결 수 | `INFO clients` | 2개를 초과 → command/pubsub 클라이언트 분리 실패 |
 


