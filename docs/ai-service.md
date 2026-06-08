# AI Service

문서 기반 RAG(Retrieval-Augmented Generation) Q&A 서비스.

| 항목 | 내용 |
|---|---|
| 포트 | 3004 |
| DB | MongoDB (문서 메타데이터 + 벡터 저장) |
| LLM | Claude / OpenAI / Gemini / Groq / Ollama (환경변수 선택) |
| 임베딩 | OpenAI text-embedding-3-small 또는 Ollama bge-m3 |

---

## REST API

### 지식베이스 관리

#### `POST /knowledge/documents` — 문서 업로드
- Content-Type: `multipart/form-data`
- 필드: `file` (텍스트 파일)
- 응답: `DocumentOutDto`
- 처리 흐름:
  1. 텍스트 청킹 (1000자 / 200자 오버랩)
  2. 임베딩 생성
  3. MongoDB 벡터 저장
  4. 문서 메타데이터 저장 (status: processed)

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

#### `GET /knowledge/documents` — 문서 목록 조회
- 응답: `DocumentOutDto[]` (생성일 내림차순)

#### `DELETE /knowledge/documents/:id` — 문서 삭제
- 동작: 벡터 청크 삭제 + 문서 메타데이터 삭제

---

### Q&A

#### `POST /qa/ask` — 질문 (SSE 스트리밍)
- 요청: `{ question: string, topK?: number }`
- 응답: `text/event-stream`
- 처리 흐름:
  1. 질문 임베딩
  2. MongoDB 벡터 유사도 검색 (Top-K, 기본 5)
  3. 검색된 청크를 시스템 프롬프트에 주입
  4. LLM 스트리밍 호출

```
data: {"text": "답변 토큰"}
data: {"text": "..."}
data: [DONE]
```

---

## 환경변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `LLM_PROVIDER` | `claude` | `claude` / `openai` / `gemini` / `groq` / `ollama` |
| `EMBEDDING_PROVIDER` | `openai` | `openai` / `ollama` |
| `OLLAMA_MODEL` | `qwen2.5:14b` | Ollama LLM 모델 |
| `OLLAMA_EMBEDDING_MODEL` | `bge-m3` | Ollama 임베딩 모델 |
| `MONGODB_VECTOR_URI` | — | MongoDB 연결 URI (필수) |

---

## 로컬 실행

```bash
# Ollama 설치 및 모델 다운로드
pnpm setup:ollama

# 서비스 실행
pnpm start:ai-service:dev

# 문서 시드 업로드
pnpm seed:knowledge
```
