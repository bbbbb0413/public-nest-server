# AI Service

<!-- AUTO-GENERATED -->

**HTTP 포트**: 3004  
**역할**: 문서 업로드 및 벡터화(RAG), LLM 기반 스트리밍 Q&A

## HTTP 엔드포인트

### Knowledge — 문서 관리

| 메서드 | 경로 | 인증 | 요청 | 응답 | 설명 |
|--------|------|------|------|------|------|
| POST | `/knowledge/documents` | - | `multipart/form-data` (file) | `DocumentOutDto` | 문서 업로드 및 벡터화 |
| GET | `/knowledge/documents` | - | - | `DocumentOutDto[]` | 문서 목록 조회 |
| DELETE | `/knowledge/documents/:id` | - | Path: `id` | 204 | 문서 및 벡터 삭제 |

**DocumentOutDto**:

```typescript
{
  id: string
  fileName: string
  mimeType: string
  status: 'pending' | 'processed' | 'failed'
  chunkCount: number
  createdAt: Date
}
```

### Q&A — RAG 스트리밍

| 메서드 | 경로 | 인증 | 요청 | 응답 | 설명 |
|--------|------|------|------|------|------|
| POST | `/qa/ask` | - | `{ question, topK? }` | SSE 스트림 | 벡터 검색 + LLM 스트리밍 답변 |

**SSE 스트리밍 포맷**:

```
Content-Type: text/event-stream

data: {"text": "<청크 텍스트>"}\n\n
data: {"text": "<청크 텍스트>"}\n\n
data: [DONE]\n\n
```

**AskInDto**:

```typescript
{
  question: string   // 질문
  topK?: number      // 검색할 문서 청크 수 (기본값 의존)
}
```

## 문서 수집(Ingest) 흐름

```
POST /knowledge/documents (파일 업로드)
  └─ IngestDocumentUseCase.execute()
       ├─ 파일 청킹 (텍스트 분할)
       ├─ 청크별 임베딩 벡터 생성 (EmbeddingProvider)
       ├─ 벡터 스토어에 저장 (VectorStorePort → MongoDBVectorAdapter)
       └─ DocumentRepository에 메타데이터 저장
```

## RAG 질문 응답 흐름

```
POST /qa/ask
  └─ AskUseCase.execute()
       ├─ 질문을 임베딩 벡터로 변환
       ├─ 벡터 스토어에서 유사 청크 topK개 검색
       ├─ 검색된 청크를 컨텍스트로 LLM에 전달
       └─ LLM 스트리밍 응답 → SSE 청크 전송
```

## LLM 및 임베딩 프로바이더

`LLM_PROVIDER` 및 `EMBEDDING_PROVIDER` 환경변수로 선택한다.

### LLM 프로바이더

| 값 | 프로바이더 | 환경변수 |
|----|----------|----------|
| `claude` (기본) | Anthropic Claude | `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` |
| `openai` | OpenAI GPT | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| `gemini` | Google Gemini | `GOOGLE_API_KEY`, `GEMINI_MODEL` |
| `groq` | Groq | `GROQ_API_KEY`, `GROQ_MODEL` |
| `ollama` | Ollama (로컬) | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` |

### 임베딩 프로바이더

| 값 | 프로바이더 | 환경변수 |
|----|----------|----------|
| `openai` (기본) | OpenAI Embeddings | `OPENAI_API_KEY`, `EMBEDDING_MODEL` |
| `ollama` | Ollama Embeddings | `OLLAMA_BASE_URL`, `OLLAMA_EMBEDDING_MODEL` |

## 로컬 LLM (Ollama) 설정

```bash
# Ollama 설치 및 모델 다운로드
pnpm setup:ollama

# Docker로 실행
pnpm docker:ai

# 시작
pnpm start:ai-service:dev
```

환경변수 설정:

```env
LLM_PROVIDER=ollama
EMBEDDING_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

## 지식 베이스 시딩

```bash
# 실제 실행
pnpm seed:knowledge

# 시뮬레이션 (dry-run)
pnpm seed:knowledge:dry
```

## 의존성

| 의존 | 용도 |
|------|------|
| MongoDB | 벡터 스토어 (청크 + 임베딩) |
| LLM API | 텍스트 생성 (Claude / OpenAI / Gemini / Groq / Ollama) |
| Embedding API | 텍스트 → 벡터 변환 |

<!-- /AUTO-GENERATED -->
