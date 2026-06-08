# AI Service — RAG 기반 Q&A 서비스 스펙

| 항목 | 내용 |
|---|---|
| 문서 상태 | Draft (v1) |
| 대상 저장소 | `apps/ai-service`, `libs/llm` |
| 작성일 | 2026-06-05 |
| 적용 범위 | `libs/llm`, `apps/ai-service` (knowledge BC, qa BC) |
| 비적용 범위 | 기존 apps/identity, apps/payment, apps/chat-service, apps/gateway |

---

## 1. 개요

### 1.1 목적

문서를 업로드하면 LLM이 해당 지식을 기반으로 Q&A 응답을 생성하는 RAG(Retrieval-Augmented Generation) 서비스를 NestJS 모노레포에 추가한다.

### 1.2 배경

- 기존 서비스는 LLM 연동 없이 동작하며, AI 기반 문서 검색 및 답변 기능이 없다.
- `langchain`, `@langchain/groq`, `@langchain/mongodb` 등 관련 패키지가 이미 설치되어 있어 재활용한다.
- 특정 LLM 벤더에 종속되지 않도록 멀티 프로바이더 추상화가 필요하다.

### 1.3 목표

1. 문서(텍스트)를 업로드하면 자동으로 청킹·임베딩·벡터 저장한다.
2. 자연어 질문 입력 시 관련 문서 청크를 검색하고 LLM으로 답변을 생성한다.
3. LLM 프로바이더를 환경변수로 교체 가능하도록 추상화한다 (Claude / OpenAI / Gemini / Groq).
4. **기존 레이어(domain / application / infrastructure)의 Clean Architecture 원칙을 그대로 적용한다.**
5. SSE(Server-Sent Events) 스트리밍으로 실시간 답변을 반환한다.

---

## 2. 아키텍처

### 2.1 전체 구조

```
libs/llm/                        ← LLM 공통 추상화 라이브러리
apps/ai-service/
├── knowledge/                   ← 문서 수집 Bounded Context
└── qa/                          ← Q&A Bounded Context
```

### 2.2 레이어 의존성

```
presentation → application → domain ← infrastructure
```

domain 레이어는 어떤 프레임워크에도 의존하지 않는다. LangChain import는 infrastructure 레이어에만 허용한다.

### 2.3 RAG 파이프라인

```
[문서 수집]
업로드 → 텍스트 추출 → 청킹 (1000 tokens / 200 overlap)
       → 임베딩 생성 (OpenAI text-embedding-3-small)
       → MongoDB 벡터 저장 ($vectorSearch 인덱스)

[Q&A]
질문 → 쿼리 임베딩 → 벡터 유사도 검색 (Top-K)
     → 시스템 프롬프트에 컨텍스트 주입
     → LLM 스트리밍 호출 → SSE 응답
```

---

## 3. libs/llm — 멀티 프로바이더 추상화

### 3.1 포트 인터페이스

```typescript
// domain/port/llm-provider.port.ts
interface ILlmProvider {
  chat(messages: LlmMessage[], options?: LlmOptions): Promise<string>;
  stream(messages: LlmMessage[], options?: LlmOptions): AsyncIterable<string>;
}

// domain/port/embedding-provider.port.ts
interface IEmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}
```

### 3.2 구현체

| Symbol | 구현체 | 패키지 | 기본 모델 |
|---|---|---|---|
| `LlmProvider` (claude) | `ClaudeProvider` | `@langchain/anthropic` | claude-sonnet-4-6 |
| `LlmProvider` (openai) | `OpenAIProvider` | `@langchain/openai` | gpt-4o |
| `LlmProvider` (gemini) | `GeminiProvider` | `@langchain/google-genai` | gemini-2.0-flash |
| `LlmProvider` (groq) | `GroqProvider` | `@langchain/groq` | llama-3.3-70b-versatile |
| `EmbeddingProvider` | `OpenAIEmbeddingProvider` | `@langchain/openai` | text-embedding-3-small |

> 임베딩은 벡터 차원 불일치 방지를 위해 항상 OpenAI를 사용한다. LLM 프로바이더만 교체 가능하다.

### 3.3 프로바이더 선택

환경변수 `LLM_PROVIDER`로 런타임에 결정된다. `LlmModule.forRootAsync()`를 호출하는 모듈이 `ConfigModule`을 import해야 한다.

```
LLM_PROVIDER=claude   → ClaudeProvider
LLM_PROVIDER=openai   → OpenAIProvider
LLM_PROVIDER=gemini   → GeminiProvider
LLM_PROVIDER=groq     → GroqProvider
```

---

## 4. knowledge BC — 문서 수집

### 4.1 도메인 모델

**Document** (AggregateRoot)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | string | MongoDB ObjectId |
| fileName | string | 원본 파일명 |
| mimeType | string | MIME 타입 |
| status | `pending \| processed \| failed` | 수집 상태 |
| chunkCount | number | 생성된 청크 수 |
| createdAt | Date | 생성 시각 |

**Chunk** (ValueObject)

| 필드 | 타입 | 설명 |
|---|---|---|
| text | string | 청크 텍스트 (비어있을 수 없음) |
| index | number | 청크 순서 (0 이상) |
| documentId | string | 부모 문서 ID |

### 4.2 팩토리 규칙

- `Document.create({ fileName, mimeType })` — 신규 생성, status=`pending`, id=undefined
- `Document.restore(props)` — DB에서 복원
- `document.markProcessed(chunkCount)` — 불변 객체 반환, status=`processed`
- `document.markFailed()` — 불변 객체 반환, status=`failed`

### 4.3 포트

```typescript
// IDocumentRepository
persist(document: Document): Promise<Document>
findById(id: string): Promise<Document | null>
findAll(): Promise<Document[]>
update(document: Document): Promise<Document>
remove(id: string): Promise<void>

// IVectorStorePort
upsert(documents: VectorDocument[]): Promise<void>
similaritySearch(queryEmbedding: number[], topK: number): Promise<SimilaritySearchResult[]>
deleteByDocumentId(documentId: string): Promise<void>
```

### 4.4 IngestDocumentUseCase

```
1. Document.create() → documentRepo.persist()  (status: pending)
2. buffer → UTF-8 텍스트 추출
3. RecursiveCharacterTextSplitter (chunkSize=1000, overlap=200)
4. embeddingProvider.embed(chunkTexts)
5. vectorStore.upsert(vectorDocs)
6. document.markProcessed(chunkCount) → documentRepo.update()
   ※ 예외 발생 시 → document.markFailed() → documentRepo.update() → 예외 재던짐
```

### 4.5 인프라 구현체

| 포트 | 구현체 | 저장소 |
|---|---|---|
| `IDocumentRepository` | `DocumentRepositoryImpl` | MongoDB `knowledge_documents` 컬렉션 |
| `IVectorStorePort` | `MongoDBVectorAdapter` | MongoDB `knowledge_chunks` 컬렉션 (`$vectorSearch`) |

### 4.6 REST API

| Method | Path | 설명 |
|---|---|---|
| `POST` | `/knowledge/documents` | 파일 업로드 (`multipart/form-data`, field: `file`) |
| `GET` | `/knowledge/documents` | 문서 목록 조회 (생성일 내림차순) |
| `DELETE` | `/knowledge/documents/:id` | 문서 + 청크 삭제 |

**POST 응답 (`DocumentOutDto`)**

```json
{
  "id": "6660abc123",
  "fileName": "manual.txt",
  "mimeType": "text/plain",
  "status": "processed",
  "chunkCount": 12,
  "createdAt": "2026-06-05T10:00:00.000Z"
}
```

---

## 5. qa BC — Q&A

### 5.1 AskUseCase

```
1. embeddingProvider.embed([question])  → queryEmbedding
2. vectorStore.similaritySearch(queryEmbedding, topK)  → chunks (Top-K)
3. buildRagMessages(question, chunks)   → [system, user] 메시지 구성
   - system: 컨텍스트 주입 (출처 파일명 포함)
   - 컨텍스트 없는 경우 "제공된 문서에서 해당 정보를 찾을 수 없습니다." 답변 유도
4. llmProvider.stream(messages)         → AsyncIterable<string>
```

### 5.2 REST API

| Method | Path | 설명 |
|---|---|---|
| `POST` | `/qa/ask` | 질문 전송, SSE 스트리밍 응답 |

**요청 (`AskInDto`)**

```json
{
  "question": "환불 정책이 어떻게 되나요?",
  "topK": 5
}
```

**SSE 응답 형식**

```
data: {"text": "환불"}
data: {"text": "은 구매일로부터"}
data: {"text": " 7일 이내에"}
...
data: [DONE]
```

---

## 6. 인프라 설정

### 6.1 MongoDB Vector Search 인덱스

`knowledge_chunks` 컬렉션에 아래 인덱스를 생성해야 서비스가 동작한다.

```json
{
  "name": "knowledge_vector_index",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      {
        "type": "vector",
        "path": "embedding",
        "numDimensions": 1536,
        "similarity": "cosine"
      }
    ]
  }
}
```

> `numDimensions: 1536` — OpenAI `text-embedding-3-small` 기준. 임베딩 모델 변경 시 인덱스 재생성 필요.

### 6.2 환경변수

| 변수 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| `AI_SERVICE_PORT` | | 3004 | 서비스 포트 |
| `LLM_PROVIDER` | | claude | LLM 프로바이더 선택 |
| `ANTHROPIC_API_KEY` | claude 시 | - | Claude API 키 |
| `OPENAI_API_KEY` | 항상 | - | 임베딩 + OpenAI LLM 시 |
| `GOOGLE_API_KEY` | gemini 시 | - | Gemini API 키 |
| `GROQ_API_KEY` | groq 시 | - | Groq API 키 |
| `CLAUDE_MODEL` | | claude-sonnet-4-6 | Claude 모델 ID |
| `OPENAI_MODEL` | | gpt-4o | OpenAI 모델 ID |
| `GEMINI_MODEL` | | gemini-2.0-flash | Gemini 모델 ID |
| `GROQ_MODEL` | | llama-3.3-70b-versatile | Groq 모델 ID |
| `EMBEDDING_MODEL` | | text-embedding-3-small | 임베딩 모델 ID |
| `MONGODB_VECTOR_URI` | ✓ | - | MongoDB 연결 URI |
| `MONGODB_DB_NAME` | | ai_service | MongoDB 데이터베이스명 |

### 6.3 실행

```bash
# 개발
pnpm start:ai-service:dev

# 빌드 후 실행
pnpm build:ai-service
pnpm start:ai-service

# 단위 테스트
pnpm test:ai
```

---

## 7. 테스트 전략

| 종류 | 대상 | 방식 |
|---|---|---|
| 단위 | `IngestDocumentUseCase` | mock IDocumentRepository, IVectorStorePort, IEmbeddingProvider |
| 단위 | `AskUseCase` | mock ILlmProvider, IEmbeddingProvider, IVectorStorePort |
| 통합 | `MongoDBVectorAdapter` | 실제 MongoDB (테스트 DB) |
| 통합 | 각 LLM Provider | 실제 API 키 (선택적) |

**포트 Symbol로 mock 제공 (구체 클래스 아님)**

```typescript
{ provide: DocumentRepository, useValue: mockRepo }
{ provide: LlmProvider, useValue: mockLlmProvider }
{ provide: EmbeddingProvider, useValue: mockEmbeddingProvider }
```

---

## 8. 제약 및 주의사항

- **임베딩 모델 고정**: `EmbeddingProvider`는 항상 OpenAI를 사용한다. 임베딩 모델을 변경하면 벡터 인덱스를 재생성하고 기존 문서를 전부 재수집해야 한다.
- **텍스트 파일 전용**: 현재 `buffer.toString('utf-8')`로 텍스트를 추출한다. PDF, DOCX 파싱은 별도 파서 도입 필요.
- **파일 크기 제한**: Multer 기본 제한 적용. 대용량 파일은 Bull Queue로 비동기 처리하도록 확장 가능.
- **MongoDB Atlas 필요**: `$vectorSearch` aggregation은 Atlas Vector Search 인덱스를 요구한다. 로컬 개발 시 `mongot` 사이드카 또는 Qdrant 어댑터로 대체 가능.
