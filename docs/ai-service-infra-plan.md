# AI Service 인프라 개선 계획

> 작성일: 2026-06-09  
> 대상: `apps/ai-service`  
> 목표: RAG 파이프라인의 비동기 처리, 응답 캐싱, 프롬프트 버전 관리 도입

---

## 전체 구현 순서

```
Phase 1 → Prompt 버전 관리     (독립적, 의존성 없음)
Phase 2 → LLM 응답 캐싱        (Phase 1 완료 후 — 프롬프트 해시에 의존)
Phase 3 → Bull Queue 인제스트  (Phase 1, 2와 독립적으로 진행 가능)
```

---

## Feature 1: Prompt 버전 관리

### 목표
시스템 프롬프트를 MongoDB에 저장하여 배포 없이 수정·롤백 가능하게 한다.

### 아키텍처

```
현재: AskUseCase.buildRagMessages() 내부 하드코딩 문자열
변경: MongoDB prompt_templates 컬렉션 → PromptTemplateRepository → AskUseCase
```

### 데이터 모델 (MongoDB)

```typescript
// prompt_templates 컬렉션
{
  _id: ObjectId,
  name: string,          // "rag-qa-system" — 용도 식별자
  version: number,       // 1, 2, 3 ...
  content: string,       // 실제 프롬프트 본문
  isActive: boolean,     // true인 버전이 실제 사용됨
  variables: string[],   // ["context", "question"] — 치환 변수 목록
  createdAt: Date,
  updatedAt: Date,
}
```

### 생성할 파일

```
apps/ai-service/src/prompt/
├── domain/
│   ├── model/prompt-template.ts                    # AggregateRoot 상속, create()/restore()
│   ├── vo/prompt-name.vo.ts                        # ValueObject
│   └── repository/prompt-template.repository.ts   # 포트 + Symbol
├── application/
│   ├── command/
│   │   ├── create-prompt.command.ts
│   │   └── activate-prompt.command.ts
│   ├── create-prompt.use-case.ts
│   ├── activate-prompt.use-case.ts
│   └── get-active-prompt.use-case.ts
├── infrastructure/
│   └── persistence/
│       └── prompt-template.repository-impl.ts     # MongoDB
├── presentation/
│   ├── dto/
│   │   ├── create-prompt-in.dto.ts
│   │   └── prompt-out.dto.ts
│   └── prompt.controller.ts
└── prompt.module.ts
```

### 수정할 파일

| 파일 | 변경 내용 |
|---|---|
| `apps/ai-service/src/qa/application/ask.use-case.ts` | `buildRagMessages()`에서 `PromptTemplateRepository`로 활성 프롬프트 조회 |
| `apps/ai-service/src/ai.module.ts` | `PromptModule` import 추가 |

### 핵심 로직

```typescript
// ask.use-case.ts 변경 요점
const template = await this.promptTemplateRepo.findActive('rag-qa-system');
const systemPrompt = template.render({ context, question });
```

```typescript
// prompt-template.ts 도메인 메서드
render(variables: Record<string, string>): string {
  return Object.entries(variables).reduce(
    (acc, [key, val]) => acc.replace(`{{${key}}}`, val),
    this.content,
  );
}
```

### API 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| `POST` | `/prompts` | 신규 버전 생성 |
| `GET` | `/prompts/:name` | 특정 이름의 버전 목록 조회 |
| `PATCH` | `/prompts/:name/:version/activate` | 특정 버전 활성화 |
| `GET` | `/prompts/:name/active` | 현재 활성 버전 조회 |

### 테스트

- `PromptTemplate.render()` 단위 테스트 — 변수 치환 정확성
- `GetActivePromptUseCase` 단위 테스트 — 활성 템플릿 없을 때 폴백
- `AskUseCase` 통합 테스트 — DB 프롬프트 반영 확인

---

## Feature 2: LLM 응답 캐싱

### 목표
동일한 질문+컨텍스트 조합의 LLM 호출을 Redis에 캐싱하여 응답 비용과 지연을 줄인다.

### 아키텍처

```
AskUseCase.execute()
  ↓
[1] 질문 임베딩 → 벡터 검색 (청크 획득)
  ↓
[2] 캐시 키 생성: SHA256(question + chunkIds.join(","))
  ↓
[3] Redis HIT  → 캐시 텍스트 스트리밍 반환
    Redis MISS → LLM 호출 → 응답 수집 → Redis 저장 → 스트리밍 반환
```

### 캐시 키 전략

```typescript
// 캐시 키: "llm:cache:<SHA256(question + sorted_chunk_ids)>"
// TTL: 1시간 (ENV로 조절 가능)
// 저장값: 전체 응답 텍스트 (JSON string)
```

### 생성할 파일

```
apps/ai-service/src/qa/
├── domain/
│   └── port/
│       └── llm-cache.port.ts              # ILlmCachePort + Symbol
└── infrastructure/
    └── cache/
        └── redis-llm-cache.adapter.ts     # ILlmCachePort 구현체, AbstractRedisRepository 상속
```

### 수정할 파일

| 파일 | 변경 내용 |
|---|---|
| `apps/ai-service/src/qa/application/ask.use-case.ts` | 캐시 HIT/MISS 분기 로직 추가 |
| `apps/ai-service/src/qa/qa.module.ts` | `LlmCachePort` 바인딩 추가 |
| `apps/ai-service/env.example` | `REDIS_DB_HOST`, `REDIS_DB_PORT`, `LLM_CACHE_TTL_SECONDS` 추가 |

### 캐시 포트 인터페이스

```typescript
export interface ILlmCachePort {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  invalidate(key: string): Promise<void>;
}
export const LlmCachePort = Symbol('LlmCachePort');
```

### 핵심 로직

```typescript
// ask.use-case.ts 변경 요점
async *execute(command: AskCommand): AsyncIterable<string> {
  const [queryEmbedding] = await this.embeddingProvider.embed([command.question]);
  const chunks = await this.vectorStore.similaritySearch(queryEmbedding, command.topK);

  const cacheKey = this.buildCacheKey(command.question, chunks);
  const cached = await this.llmCache.get(cacheKey);
  if (cached) {
    yield* this.streamFromString(cached);   // 캐시 HIT
    return;
  }

  const messages = await this.buildRagMessages(command.question, chunks);
  const collected: string[] = [];
  for await (const chunk of this.llmProvider.stream(messages)) {
    collected.push(chunk);
    yield chunk;
  }
  await this.llmCache.set(cacheKey, collected.join(''), this.cacheTtl);
}

private buildCacheKey(question: string, chunks: SimilaritySearchResult[]): string {
  const ids = chunks.map((c) => c.metadata.documentId).sort().join(',');
  return createHash('sha256').update(`${question}|${ids}`).digest('hex');
}
```

### 테스트

- `AskUseCase` 단위 테스트 — 캐시 HIT 시 `llmProvider.stream()` 미호출 검증
- `AskUseCase` 단위 테스트 — 캐시 MISS 시 LLM 호출 후 캐시 저장 검증
- `RedisLlmCacheAdapter` 단위 테스트 — TTL 설정 검증

---

## Feature 3: Bull Queue 인제스트 비동기화

### 목표
문서 업로드 API를 즉시 반환하고, 텍스트 분할·임베딩·벡터 저장은 Bull Queue 워커가 비동기 처리한다.

### 현재 문제

```
현재: POST /knowledge/documents → IngestDocumentUseCase.execute() → (동기) → 응답
      문서 크기에 비례해 HTTP 응답 지연 발생 (수십 초 가능)
```

### 변경 후 흐름

```
POST /knowledge/documents
  → Document 메타데이터 저장 (status: "pending")
  → Bull Queue에 ingest 잡 추가
  → 202 Accepted + { jobId, documentId } 즉시 반환

Worker (IngestConsumer)
  → 잡 수신 → IngestDocumentUseCase.execute() 실행
  → Document status: "processed" / "failed" 업데이트

GET /knowledge/documents/:id   (신규)
  → Document 상태 폴링
```

### 아키텍처

```
KnowledgeController
  ↓ upload()
IngestQueueService.enqueue(command)         ← 신규
  ↓ queue.add('ingest', payload)
  [202 반환]

IngestConsumer (@Processor)                 ← 신규
  @Process('ingest')
  ↓
IngestDocumentUseCase.execute()             ← 기존 재사용 (documentId 주입 지원 추가)
```

### 생성할 파일

```
apps/ai-service/src/knowledge/
├── application/
│   └── ingest-queue.service.ts             # Bull Queue add 담당
└── infrastructure/
    └── queue/
        └── ingest.consumer.ts              # @Processor('ingest'), IngestDocumentUseCase 호출
```

### 수정할 파일

| 파일 | 변경 내용 |
|---|---|
| `apps/ai-service/src/knowledge/application/ingest-document.command.ts` | `documentId?: string` 옵셔널 추가 |
| `apps/ai-service/src/knowledge/application/ingest-document.use-case.ts` | 기존 Document 재사용 분기 추가 |
| `apps/ai-service/src/knowledge/presentation/knowledge.controller.ts` | `IngestQueueService` 사용, 202 응답으로 변경 |
| `apps/ai-service/src/knowledge/knowledge.module.ts` | `BullModule.registerQueue`, `IngestConsumer` 등록 |
| `apps/ai-service/src/ai.module.ts` | `BullModule.forRoot()` 추가 |
| `apps/ai-service/env.example` | `REDIS_DB_HOST`, `REDIS_DB_PORT` 추가 |

### 잡 페이로드

```typescript
// Buffer를 직렬화 가능한 형태로 변환
interface IngestJobPayload {
  documentId: string;
  fileName: string;
  mimeType: string;
  content: string;   // Buffer.toString('base64')
}
```

### IngestConsumer 패턴

```typescript
@Processor('ingest')
export class IngestConsumer {
  @Process('ingest')
  async handle(job: Job<IngestJobPayload>): Promise<void> {
    const { documentId, fileName, mimeType, content } = job.data;
    const buffer = Buffer.from(content, 'base64');
    await this.ingestUseCase.execute({ documentId, fileName, mimeType, buffer });
  }

  @OnQueueFailed({ name: 'ingest' })
  onFailed(job: Job, err: Error): void {
    this.logger.error(`문서 인제스트 실패: ${job.data.fileName} — ${err.message}`);
  }
}
```

### API 변경

| Method | Path | 기존 | 변경 |
|---|---|---|---|
| `POST` | `/knowledge/documents` | 201 + DocumentOutDto | 202 + `{ jobId, documentId, status: "pending" }` |
| `GET` | `/knowledge/documents/:id` | — | 신규: 단건 조회 (status 포함) |

### 테스트

- `IngestQueueService` 단위 테스트 — `queue.add()` 호출 인수 검증
- `IngestConsumer` 단위 테스트 — `IngestDocumentUseCase.execute()` 위임 검증
- `KnowledgeController` 단위 테스트 — 202 응답 및 jobId 반환 검증

---

## 구현 체크리스트

### Phase 1: Prompt 버전 관리

- [x] `PromptTemplate` 도메인 모델 (create / restore / render)
- [x] `PromptName` VO
- [x] `IPromptTemplateRepository` 포트 + Symbol
- [x] `PromptTemplateRepositoryImpl` (MongoDB)
- [x] `CreatePromptUseCase`
- [x] `ActivatePromptUseCase`
- [x] `GetActivePromptUseCase`
- [x] `PromptController` + DTO
- [x] `PromptModule`
- [x] `AskUseCase` — DB 프롬프트 조회로 교체
- [x] 단위 테스트

### Phase 2: LLM 응답 캐싱

- [x] `ILlmCachePort` 포트 + Symbol
- [x] `RedisLlmCacheAdapter` (AbstractRedisRepository 상속)
- [x] `AskUseCase` — 캐시 HIT/MISS 분기
- [x] `QaModule` — 포트 바인딩
- [x] `env.example` 업데이트
- [x] 단위 테스트

### Phase 3: Bull Queue 인제스트

- [x] `IngestDocumentCommand` — `documentId` 옵셔널 추가
- [x] `IngestDocumentUseCase` — 기존 Document 재사용 분기
- [x] `IngestQueueService`
- [x] `IngestConsumer` (@Processor)
- [x] `KnowledgeController` — 202 응답
- [x] `KnowledgeModule` — BullModule 등록
- [x] `AiModule` — BullModule.forRoot() 추가
- [x] `env.example` 업데이트
- [x] 단위 테스트

---

## 공유 인프라 메모

- **Redis**: `libs/common/src/databases/redis/` — `AbstractRedisRepository`, `RedisFactory` 재사용
- **Bull**: identity 서비스 `BullModule.forRoot` 패턴 동일하게 적용
- **MongoDB**: 기존 `MONGODB_VECTOR_URI` / `MONGODB_DB_NAME` 환경변수 공유 (별도 컬렉션 사용)
