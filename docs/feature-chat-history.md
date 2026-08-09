# 유저별 AI 채팅 대화 이력 저장 기능 — 개발 명세서

## 1. 현황 분석

### 1.1 현재 AI QA 채팅 흐름

```
클라이언트
  → POST /qa/ask (conversationHistory?: ConversationTurnDto[])
  → QaController.ask()
  → AskUseCase.execute(AskCommand)
  → LLM 스트리밍 응답 (SSE)
```

**문제**: 클라이언트가 매 요청마다 `conversationHistory` 배열을 직접 전달해야 한다. 서버에 저장되지 않으므로 세션이 끊기면 대화 이력을 잃는다.

### 1.2 현재 데이터 저장 구조

| 서비스 | DB | 컬렉션/테이블 |
|--------|-----|---------------|
| ai-service | MongoDB | `knowledge_chunks`, `knowledge_documents`, `llm_cost_logs` |
| identity | MySQL | 게임 계정, 사용자 |
| chat-service | Redis | WebSocket 채팅 메시지 (일반 채팅) |

AI QA 대화는 어떤 저장소에도 보존되지 않는다.

---

## 2. 기능 설계

### 2.1 목표

- `userId` 기반으로 AI QA 대화 세션을 서버에 저장한다.
- `sessionId`가 주어지면 기존 세션에 턴(turn)을 추가한다.
- `sessionId`가 없으면 신규 세션을 생성하고 응답 헤더에 `X-Session-Id`를 반환한다.
- 세션 목록 조회, 단건 조회, 삭제 API를 제공한다.

### 2.2 데이터 흐름 (변경 후)

```
클라이언트
  → POST /qa/ask { question, sessionId? }
  → QaController
      ├─ sessionId 없음 → ConversationSessionRepository.persist(신규 세션)
      └─ sessionId 있음 → ConversationSessionRepository.findById(sessionId)
  → AskUseCase (세션의 turns를 conversationHistory로 LLM에 전달)
  → LLM 스트리밍 응답 (SSE)
  → 응답 완료 후 QaController → ConversationSessionRepository.update(turn 추가)
  → 클라이언트 (응답 헤더: X-Session-Id)
```

---

## 3. MongoDB 스키마 — `conversation_sessions`

```
컬렉션명: conversation_sessions

{
  sessionId: string,      // UUID v4, 외부 노출 ID (unique)
  userId: string,         // 요청자 userId
  title: string,          // 첫 번째 질문의 앞 50자 (자동 생성)
  turns: [
    {
      role: 'user' | 'assistant',
      content: string,
      createdAt: Date,     // ISO 8601 UTC
    }
  ],
  createdAt: Date,        // 세션 생성 시각
  updatedAt: Date,        // 마지막 턴 추가 시각 (TTL 인덱스 기준)
}
```

**인덱스** (OnModuleInit에서 자동 생성):
- `{ userId: 1, updatedAt: -1 }` — 유저별 세션 목록 페이지네이션
- `{ sessionId: 1 }` unique — 단건 조회
- `{ updatedAt: 1 }` TTL 90일 — 오래된 세션 자동 삭제

---

## 4. 구현 파일 목록

Clean Architecture 의존성 방향: `domain ← infrastructure ← application ← presentation`

### 4.1 도메인 레이어 (신규)

**`apps/ai-service/src/qa/domain/vo/session-id.vo.ts`**
```typescript
// SessionId extends ValueObject<string>
// static generate(): SessionId  — crypto.randomUUID()
// static of(id: string): SessionId
```

**`apps/ai-service/src/qa/domain/vo/conversation-turn.vo.ts`**
```typescript
// ConversationTurn extends ValueObject<{ role, content, createdAt }>
// static ofUser(content: string): ConversationTurn
// static ofAssistant(content: string): ConversationTurn
```

**`apps/ai-service/src/qa/domain/model/conversation-session.ts`**
```typescript
// ConversationSession extends AggregateRoot
// private constructor(sessionId, userId, title, turns, createdAt, updatedAt)
// static create(userId: string, firstQuestion: string): ConversationSession
// static restore(props): ConversationSession
// appendTurn(userContent, assistantContent): ConversationSession  — 새 인스턴스 반환 (immutable)
// getHistory(): Array<{ role, content }>  — LLM context 전달용
// getSessionId(): string
// getUserId(): string
```

**`apps/ai-service/src/qa/domain/repository/conversation-session.repository.ts`**
```typescript
export interface IConversationSessionRepository {
  findById(sessionId: string): Promise<ConversationSession | null>;
  findByUserId(userId: string, page: number, limit: number): Promise<ConversationSession[]>;
  persist(session: ConversationSession): Promise<ConversationSession>;
  update(session: ConversationSession): Promise<ConversationSession>;
  deleteById(sessionId: string): Promise<void>;
}
export const ConversationSessionRepository = Symbol('ConversationSessionRepository');
```

### 4.2 인프라 레이어 (신규)

**`apps/ai-service/src/qa/infrastructure/persistence/conversation-session.mapper.ts`**
```typescript
// toDomain(doc: ConversationSessionDocument): ConversationSession
// toDocument(domain: ConversationSession): ConversationSessionDocument
```

**`apps/ai-service/src/qa/infrastructure/persistence/conversation-session.repository-impl.ts`**
```typescript
// IConversationSessionRepository 구현
// MongoClient 직접 사용 (knowledge 모듈 패턴 동일)
// OnModuleInit에서 인덱스 3개 생성 (CLAUDE.md 규칙)
// collection: 'conversation_sessions'
```

### 4.3 애플리케이션 레이어 (신규/수정)

**`apps/ai-service/src/qa/application/command/save-conversation-turn.command.ts`** (신규)
```typescript
export class SaveConversationTurnCommand {
  constructor(
    readonly sessionId: string,
    readonly userContent: string,
    readonly assistantContent: string,
  ) {}
}
```

**`apps/ai-service/src/qa/application/get-sessions.use-case.ts`** (신규)
```typescript
// userId, page, limit → ConversationSession[]
```

**`apps/ai-service/src/qa/application/get-session.use-case.ts`** (신규)
```typescript
// sessionId → ConversationSession | null
```

**`apps/ai-service/src/qa/application/delete-session.use-case.ts`** (신규)
```typescript
// sessionId → void
```

**`apps/ai-service/src/qa/application/ask.command.ts`** (수정)
- `sessionId?: string` 필드 추가

**`apps/ai-service/src/qa/application/ask.use-case.ts`** (수정)
- `execute()` 내부에서 `conversationHistory` 파라미터 없고 `sessionId` 있으면 세션에서 history 로드
- 세션 저장은 컨트롤러가 담당 (스트리밍 완료 시점 제어를 위해)

### 4.4 프레젠테이션 레이어 (신규/수정)

**`apps/ai-service/src/qa/presentation/dto/session-out.dto.ts`** (신규)
```typescript
export class SessionOutDto {
  sessionId: string;
  title: string;
  turnCount: number;
  updatedAt: string;  // ISO 8601
  static fromDomain(session: ConversationSession): SessionOutDto
}

export class SessionDetailOutDto {
  sessionId: string;
  title: string;
  turns: { role: string; content: string; createdAt: string }[];
  static fromDomain(session: ConversationSession): SessionDetailOutDto
}
```

**`apps/ai-service/src/qa/presentation/dto/ask-in.dto.ts`** (수정)
```typescript
@IsString()
@IsOptional()
sessionId?: string;
// 기존 conversationHistory 필드 유지 (하위 호환)
```

**`apps/ai-service/src/qa/presentation/qa.controller.ts`** (수정)
```typescript
// ask() 수정:
//   - sessionId 없으면 신규 세션 생성
//   - sessionId 있으면 세션 로드 → history를 AskCommand에 전달
//   - 스트리밍 완료(for await 루프 종료) 후 세션에 turn 저장
//   - res.setHeader('X-Session-Id', sessionId)

@Get('sessions')
async getSessions(@Query() query): Promise<SessionOutDto[]>

@Get('sessions/:sessionId')
async getSession(@Param('sessionId') sessionId: string): Promise<SessionDetailOutDto>

@Delete('sessions/:sessionId')
@HttpCode(204)
async deleteSession(@Param('sessionId') sessionId: string): Promise<void>
```

**`apps/ai-service/src/qa/qa.module.ts`** (수정)
- `ConversationSessionRepositoryImpl` provider 추가
- `{ provide: ConversationSessionRepository, useClass: ConversationSessionRepositoryImpl }` 바인딩
- `GetSessionsUseCase`, `GetSessionUseCase`, `DeleteSessionUseCase` provider 추가

---

## 5. API 명세

### POST /qa/ask (수정)

**Request Body**
```json
{
  "question": "스킬 쿨타임이 얼마나 되나요?",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "topK": 5
}
```

**Response Headers**
```
X-Session-Id: 550e8400-e29b-41d4-a716-446655440000
Content-Type: text/event-stream
```

**동작**:
1. `sessionId` 없음 → 신규 세션 생성, UUID를 `X-Session-Id` 헤더로 반환
2. `sessionId` 있음 → 기존 세션 로드, turns를 LLM context에 주입
3. 스트리밍 응답 완료 후 user/assistant 턴 쌍을 세션에 저장

---

### GET /qa/sessions?userId=&page=1&limit=20

```json
[
  {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "스킬 쿨타임이 얼마나 되나요?",
    "turnCount": 4,
    "updatedAt": "2026-06-30T10:30:00.000Z"
  }
]
```

---

### GET /qa/sessions/:sessionId

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "title": "스킬 쿨타임이 얼마나 되나요?",
  "turns": [
    { "role": "user", "content": "스킬 쿨타임이 얼마나 되나요?", "createdAt": "2026-06-30T10:00:00.000Z" },
    { "role": "assistant", "content": "해당 스킬의 쿨타임은 30초입니다.", "createdAt": "2026-06-30T10:00:01.000Z" }
  ]
}
```

타인 세션 요청 시: `403 Forbidden`
존재하지 않는 세션: `404 Not Found`

---

### DELETE /qa/sessions/:sessionId

응답: `204 No Content`

---

## 6. 구현 순서

아래 순서대로 작성하면 각 단계가 의존하는 하위 레이어가 먼저 완성된다.

| 순서 | 파일 | 비고 |
|------|------|------|
| 1 | `session-id.vo.ts` | 도메인 VO |
| 2 | `conversation-turn.vo.ts` | 도메인 VO |
| 3 | `conversation-session.ts` | 도메인 모델 |
| 4 | `conversation-session.repository.ts` | 도메인 포트 (인터페이스 + Symbol) |
| 5 | `conversation-session.mapper.ts` | 인프라 매퍼 |
| 6 | `conversation-session.repository-impl.ts` | 인프라 구현체 + 인덱스 생성 |
| 7 | `save-conversation-turn.command.ts` | 애플리케이션 커맨드 |
| 8 | `get-sessions.use-case.ts` | 애플리케이션 UseCase |
| 9 | `get-session.use-case.ts` | 애플리케이션 UseCase |
| 10 | `delete-session.use-case.ts` | 애플리케이션 UseCase |
| 11 | `ask.command.ts` 수정 | `sessionId` 추가 |
| 12 | `ask.use-case.ts` 수정 | 세션 history 로드 로직 |
| 13 | `session-out.dto.ts` | 프레젠테이션 DTO |
| 14 | `ask-in.dto.ts` 수정 | `sessionId` 추가 |
| 15 | `qa.controller.ts` 수정 | 신규 엔드포인트 + ask 수정 |
| 16 | `qa.module.ts` 수정 | provider/바인딩 등록 |

---

## 7. 주의사항

### 7.1 스트리밍 완료 후 저장 시점

SSE 스트리밍 중에는 assistant 응답이 조각으로 온다. 완전한 응답을 저장해야 하므로 컨트롤러의 `for await` 루프가 끝난 직후 저장한다.

```typescript
// qa.controller.ts — ask() 내부
let fullAssistantResponse = '';
for await (const chunk of stream) {
  if (!chunk.startsWith('__SOURCES:')) {
    fullAssistantResponse += chunk;
  }
  // SSE write ...
}
res.write('data: [DONE]\n\n');
// 루프 종료 후 저장
await this.getSessionUseCase  // 세션 업데이트
  .appendAndSave(sessionId, dto.question, fullAssistantResponse);
```

### 7.2 conversationHistory 우선순위

`AskInDto.conversationHistory`가 명시적으로 전달되면 세션 history보다 우선 적용한다 (하위 호환). 클라이언트는 점진적으로 `conversationHistory` 전달을 생략하고 `sessionId`만 전달하는 방식으로 마이그레이션할 수 있다.

### 7.3 타인 세션 접근 방어

`GET /qa/sessions/:sessionId`와 `DELETE /qa/sessions/:sessionId`에서 세션의 `userId`와 요청의 `userId`를 대조한다.

```typescript
if (session.getUserId() !== requestUserId) {
  throw new ForbiddenException('접근 권한이 없습니다.');
}
```

---

## 8. 테스트 체크리스트

- [ ] `ConversationSession.appendTurn()` — 원본 불변, 새 인스턴스 반환 검증
- [ ] `SessionId.generate()` — UUID v4 형식 검증
- [ ] `POST /qa/ask` — sessionId 없음 → X-Session-Id 헤더 반환
- [ ] `POST /qa/ask` — sessionId 있음 → 기존 세션의 history가 LLM에 전달됨
- [ ] `POST /qa/ask` — 스트리밍 완료 후 turn이 세션에 저장됨
- [ ] `GET /qa/sessions` — userId 기반 페이지네이션 (updatedAt 내림차순)
- [ ] `GET /qa/sessions/:id` — 타인 세션 조회 시 403
- [ ] `GET /qa/sessions/:id` — 존재하지 않는 sessionId 조회 시 404
- [ ] `DELETE /qa/sessions/:id` — 삭제 후 재조회 시 404
- [ ] MongoDB TTL/unique 인덱스 OnModuleInit 자동 생성 확인
