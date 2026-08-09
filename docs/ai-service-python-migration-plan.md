# AI Service — NestJS → Python 마이그레이션 계획

> **개정 이력**: v2에서 요청 흐름을 "프론트 → Python 직접 호출"에서 "프론트 → NestJS Gateway(인증) → Kafka(잡 발행) → Python(비동기 처리) → Redis Streams 경유 SSE 푸시" 구조로 전면 개편했다. 아래 §2가 이번 개정의 핵심이며, 나머지 섹션은 이에 맞춰 갱신했다.

## 0. 요약

`apps/ai-service`(NestJS, TypeScript)를 Python 기반 서비스로 재작성하되, 이번 개정으로 **요청 경로 자체도 함께 바꾼다**:

- (v1, 폐기) 프론트 → Python `ai-service` 직접 HTTP 호출(포트 3004 공개)
- **(v2, 채택) 프론트 → NestJS `gateway`(인증) → Kafka(잡 발행, `jobId` 발급) → Python(비동기 소비·처리) → Redis Streams(결과 릴레이) → Gateway → 프론트 SSE(`jobId` 기준 구독)**

핵심 원칙:
1. **Python 서비스는 더 이상 인터넷에 노출되지 않는다.** 모든 프론트 트래픽은 `gateway`를 거친다 — 기존 identity/payment/chat이 gRPC로 gateway 뒤에 있는 것과 동일한 위치로 ai-service를 편입시킨다.
2. **인증은 전적으로 Gateway 책임**이다. `GatewayAuthGuard`(JWT/API-Key/Basic)를 그대로 재사용한다.
3. **긴 작업(질의응답 추론, 문서 인제스트)은 Kafka를 통한 비동기 잡**으로 처리하고, 결과는 `jobId` 기준 SSE로 푸시한다.
4. **빠른 동기 CRUD(prompt 관리, 비용 조회, 세션 조회 등)는 잡 패턴을 적용하지 않고** Gateway가 Python 내부 API를 그대로 프록시한다 — 모든 걸 Kafka로 밀어넣는 과설계를 피한다.
5. MongoDB 데이터 재사용, Clean Architecture 레이어 유지 원칙은 v1과 동일하게 유지한다.

---

## 1. 현재 시스템 분석 (as-is, 변경 없음)

### 1.1 기술 스택

| 영역 | 현재 (NestJS) |
|---|---|
| 프레임워크 | NestJS 11 |
| LLM 오케스트레이션 | LangChain.js, LangSmith |
| LLM 프로바이더 | Claude / OpenAI / Gemini / Groq / Ollama (환경변수 스위치) |
| 벡터 DB | MongoDB Atlas `$vectorSearch` (`knowledge_chunks` 컬렉션) |
| 캐시/큐 | Redis (Bull 큐 — 문서 인제스트, RAGAS 평가 / 시맨틱 캐시, LLM 응답 캐시) |
| 비용 로그 DB | MySQL (TypeORM, `llm_cost_log`) |
| 관측성 | OpenTelemetry(GenAI 컨벤션) + Prometheus |
| 인증 | 현재는 `ai-service` 자체에 관리자 API Key 가드만 존재, 사용자 인증 없음(직접 노출) |

### 1.2 모듈 구조 (DDD/Clean Architecture)

```
apps/ai-service/src/
├── knowledge/       # 문서 업로드·청킹·임베딩·벡터 저장
├── qa/              # RAG Q&A 코어 (하이브리드 검색, 에이전틱 루프, 가드레일)
├── prompt/          # 프롬프트 템플릿 버전 관리/활성화
├── llm-gateway/      # LLM 라우팅·폴백·서킷브레이커·비용 추적
└── observability/    # RAGAS 평가, 큐 상태
```

- **knowledge**: 청킹(1000/200 오버랩) → 임베딩 → `MongoDBVectorAdapter.upsert` → Bull 큐(`ingest.consumer.ts`) 비동기 처리. 벡터 인덱스는 앱이 `OnModuleInit`에서 직접 관리.
- **qa**: `AgenticAskUseCase` — 하이브리드 검색(`RrfFusionService`) → HyDE → LLM 스트리밍 → `CritiqueGeneratorService` 신뢰도 평가 → 미달 시 `QueryRefinerService` 재작성 후 반복(self-refine, `IterationBudget`). `RagContentValidator`/`SecretPiiScanner` 가드레일.
- **prompt**: 템플릿 CRUD + 버전 활성화.
- **llm-gateway**: 모델 라우팅 → 폴백 스트리밍 → 비용 추적(MySQL) → 서킷브레이커 → LangSmith.
- **observability**: RAGAS 평가 큐 컨슈머, 큐 상태 조회.

### 1.3 gateway 앱의 기존 패턴 (신규 통합 지점)

- `apps/gateway/src/auth/gateway-auth.guard.ts` — `GatewayAuthGuard`: Authorization 헤더(`Bearer`→JWT, `Basic`) 또는 `x-api-key`로 다중 인증 전략을 선택하고 `request.session`에 `@libs/shared-kernel`의 `Session`을 바인딩한다. **이번 개정에서 그대로 재사용**한다.
- `apps/gateway/src/grpc-clients.module.ts` — `ClientsModule.register([...])`로 identity/payment/chat을 gRPC 클라이언트로 등록하는 패턴. ai-service는 gRPC 대신 **Kafka 프로듀서**로 등록한다(§2.5).
- `apps/gateway/src/chat/chat-gateway.gateway.ts` — Socket.IO `handleConnection()`에서 커넥션 레벨 인증, 실패 시 즉시 `disconnect(true)`. **SSE 커넥션 인증도 동일한 원칙**(연결 시점에 인증, 지연 검사 금지)을 따른다.
- `gateway.module.ts`에 이미 `BullModule.forRoot`로 Redis가 연결되어 있음 — **결과 릴레이용 Redis Streams를 추가 인프라 없이 재사용**할 수 있다.

### 1.4 REST API 표면 (v1 기준, v2에서 재편됨 — §2.9 참고)

`/knowledge/documents`, `/qa/ask`(SSE), `/qa/sessions*`, `/prompts*`, `/llm-gateway/costs|breakers`, `/observability/*` — 상세는 §2.9의 변경 후 표와 비교.

---

## 2. 목표 아키텍처 — 요청 흐름 개편 (이번 개정의 핵심)

### 2.1 설계 원칙

- **Python 서비스는 내부 전용(internal-only)이 된다.** Docker 네트워크 내부에서만 접근 가능하고, 호스트에 포트를 공개하지 않는다.
- **Kafka는 "긴 비동기 작업의 잡 큐"** 역할만 담당한다. LLM 토큰처럼 초당 다수 발생하는 저지연 스트림을 Kafka에 그대로 태우지 않는다(파티션/컨슈머 그룹 오버헤드, 순서 보장 비용이 스트리밍 토큰 단위엔 부적합).
- **Redis Streams**를 "잡 결과 릴레이" 계층으로 둔다. Pub/Sub이 아닌 Streams를 쓰는 이유는 **SSE 재연결 시 유실 없는 재생(replay)**이 필요하기 때문(`XADD`로 적재, Gateway가 `XREAD`로 소비, SSE의 `Last-Event-ID`와 자연스럽게 매핑).
- **잡 소유권 검증**: `jobId`는 발급한 사용자만 SSE로 구독할 수 있어야 한다 → Gateway가 `job:{jobId}` 메타데이터(Redis, TTL)에 `userId`를 기록하고 SSE 연결 시점에 대조한다.
- **잡 패턴은 필요한 곳에만 적용**한다: `/qa/ask`(추론, 긴 스트리밍)과 `/knowledge/documents`(업로드+인제스트)만 Kafka+SSE 잡 패턴을 쓰고, 나머지 CRUD/조회 엔드포인트는 Gateway가 Python 내부 REST를 동기 프록시한다.

### 2.2 컴포넌트별 책임

| 컴포넌트 | 책임 |
|---|---|
| **Frontend** | ① 잡 시작 요청(POST, 인증 헤더 포함) → `jobId` 수신 ② `GET /ai/jobs/:jobId/stream`(SSE, 동일 인증)으로 결과 수신 |
| **NestJS Gateway** | 인증(`GatewayAuthGuard` 재사용) → 잡 메타데이터 기록(Redis) → Kafka 프로듀서로 요청 발행 → `jobId` 즉시 응답(202) → SSE 엔드포인트에서 Redis Streams 컨슈머로 결과 릴레이 → 완료/에러/타임아웃 시 스트림 종료 |
| **Kafka** | Gateway → Python 간 내구성 있는 잡 큐. 토픽: `ai.qa.ask.requested`, `ai.knowledge.ingest.requested`(§2.5) |
| **Python AI Service** | Kafka 컨슈머로 잡 소비 → RAG 파이프라인 실행 → 토큰/진행상황을 Redis Streams(`ai:job:{jobId}:events`)에 적재 → 완료 시 종료 이벤트 적재. 동기 CRUD용 내부 HTTP API도 노출(Gateway에서만 접근 가능) |
| **Redis** | ① 잡 소유권 메타데이터(`job:{jobId}` 해시, TTL) ② 결과 릴레이용 Streams(`ai:job:{jobId}:events`, 잡 종료 후 일정 시간 뒤 trim/expire) |
| **MongoDB / MySQL** | v1과 동일 (벡터 저장, 비용 로그) |

### 2.3 상세 흐름 — `/qa/ask` 잡 시작

```
1. Frontend  --POST /ai/qa/jobs (Authorization: Bearer ...)--> Gateway
2. Gateway   : GatewayAuthGuard 통과 → session.uuid 확보
3. Gateway   : jobId = uuid() 생성
              Redis: HSET job:{jobId} userId=<session.uuid> type=qa.ask status=queued createdAt=... (TTL 예: 1h)
4. Gateway   : Kafka producer.send('ai.qa.ask.requested', {
                 jobId, userId: session.uuid, tenant, question, topK, useHyde,
                 sessionId, conversationHistory
               })  // key = jobId (동일 잡의 재시도/순서 보장)
5. Gateway   --202 Accepted { jobId }--> Frontend
```

### 2.4 상세 흐름 — SSE 결과 수신

```
6. Frontend  --GET /ai/jobs/:jobId/stream (Authorization, Last-Event-ID?)--> Gateway
7. Gateway   : Redis HGET job:{jobId} 로 소유권 검증(userId 불일치 시 403, 없으면 404)
              불일치/만료 시 즉시 연결 종료 (chat-service의 handleConnection 즉시 disconnect 패턴과 동일 원칙)
8. Gateway   : Redis Streams XREAD(BLOCK) on "ai:job:{jobId}:events"
              (Last-Event-ID 헤더가 있으면 해당 스트림 ID부터 재생 — 재연결 시 유실 방지)
9. Python    : Kafka consumer가 5번 메시지를 소비, AgenticAskUseCase 실행
              토큰 생성마다: XADD ai:job:{jobId}:events * type=token data=<token>
              소스 확정 시: XADD ... type=sources data=<json>
              완료 시:      XADD ... type=done
              실패 시:      XADD ... type=error data=<message>
10. Gateway  : XREAD로 읽은 각 엔트리를 SSE로 그대로 전달
              data: {"type":"token","text":"..."}
              ...
              type=done 수신 시 data: [DONE] 전송 후 커넥션 종료, 컨슈머 해제
11. Gateway  : 클라이언트 disconnect 시 XREAD 루프 중단 (리소스 누수 방지)
```

- 기존 v1의 SSE 프로토콜(`data: {"text":...}`, `data: [DONE]`, `__SOURCES:` prefix)은 프론트가 새 엔드포인트로 이전하는 시점에 함께 정리한다. 이번 개정에서는 이벤트 타입을 명시하는 형태(`type: token|sources|done|error`)로 프로토콜을 살짝 개선해 프론트 파싱을 단순화할 것을 권장하되, **프론트 이전 공수를 최소화하려면 기존 페이로드 포맷을 유지한 채 전송 경로만 바꾸는 것도 가능** — 이 부분은 프론트 담당자와 확정 필요(선택지로만 남긴다).

### 2.5 Kafka 토픽 설계

| 토픽 | 프로듀서 | 컨슈머 | 용도 |
|---|---|---|---|
| `ai.qa.ask.requested` | Gateway | Python(consumer group `ai-service-qa`) | Q&A 잡 요청 |
| `ai.knowledge.ingest.requested` | Gateway | Python(consumer group `ai-service-ingest`) | 문서 인제스트 잡 요청 (기존 Bull 큐 대체) |
| `ai.knowledge.ingest.completed` | Python | (선택) `ai-service-observability`, 감사로그 컨슈머 | 인제스트 완료 이벤트 — RAGAS 평가 트리거, 감사/모니터링용 내구성 로그 |
| `ai.qa.ask.completed` | Python | (선택) 관측성/감사 | 완료된 Q&A 잡의 최종 결과 요약(토큰이 아닌 완성된 답변) — RAGAS 평가 파이프라인이 구독 |

- **메시지 키는 `jobId`**로 고정해 동일 잡의 재시도/파티션 순서를 보장한다.
- Consumer는 **at-least-once**를 전제로 멱등 처리한다: 처리 시작 전 Redis `job:{jobId}.status`를 확인해 이미 `processing`/`done`이면 중복 처리를 건너뛴다.
- 처리 실패 시 재시도 정책 + Dead Letter 토픽(`ai.qa.ask.dlq` 등)을 둔다.

### 2.6 재연결/유실 방지 (Redis Streams)

- Pub/Sub 대신 **Streams**를 쓰는 이유: 프론트 네트워크 순단으로 SSE가 끊겼다가 재연결될 때, Pub/Sub은 그 사이 발행된 메시지를 영구히 잃지만 Streams는 `XREAD` 시작 ID를 지정해 **놓친 구간부터 재생**할 수 있다.
- SSE 표준의 `Last-Event-ID` 헤더에 Redis Stream 엔트리 ID(`1700000000000-0` 형식)를 그대로 실어 보내면, Gateway가 재연결 시 해당 ID 이후부터 `XREAD`를 재개하도록 구현할 수 있다.
- 잡 완료(`type=done`/`error`) 후 일정 시간(예: 5분) 뒤 해당 스트림 키를 `EXPIRE`로 정리한다.

### 2.7 문서 인제스트(`/knowledge/documents`)에 대한 적용

- 파일 바이너리를 Kafka 메시지에 직접 싣지 않는다(Kafka는 대용량 바이너리에 부적합). Gateway가 업로드된 파일을 **공유 오브젝트 스토리지(또는 임시 볼륨/GridFS)**에 먼저 저장하고, Kafka 메시지에는 `jobId + fileRef(경로 또는 GridFS id)`만 담는다.
- 이후 흐름은 §2.3~2.4와 동일(진행률/완료를 SSE로 push). 프론트는 업로드 후 진행 상태를 SSE로 구독하거나, 단순 폴링으로 처리해도 무방 — 우선순위는 `/qa/ask`보다 낮음(Phase 배치는 §7 참고).

### 2.8 동기 CRUD 엔드포인트 (잡 패턴 미적용)

`/prompts*`, `/llm-gateway/costs`, `/llm-gateway/breakers`, `/observability/ragas-evals`, `/observability/queues`, `/qa/sessions*`(세션 목록/조회/삭제)는 지연이 짧고 스트리밍이 필요 없으므로 **Kafka를 거치지 않는다**. Gateway가 `GatewayAuthGuard` 통과 후 Python의 내부 전용 HTTP API(`http://ai-service:8000/...`, 서비스 메시 내부망)를 그대로 프록시한다 — identity/payment가 gRPC로 프록시되는 것과 동일한 위치의 REST 프록시 버전.

### 2.9 REST API 계약 변경 요약

| v1 (Python 직접 노출) | v2 (Gateway 경유) |
|---|---|
| `POST /qa/ask` (SSE 직결) | `POST /ai/qa/jobs` (202 + jobId) → `GET /ai/jobs/:jobId/stream` (SSE) |
| `POST /knowledge/documents` | `POST /ai/knowledge/jobs` (202 + jobId) → `GET /ai/jobs/:jobId/stream` (SSE, 진행률) |
| `GET/DELETE /qa/sessions*` | `GET/DELETE /ai/qa/sessions*` (동기 프록시, 변경 없음) |
| `POST/GET/PATCH /prompts*` | `/ai/prompts*` (동기 프록시, 변경 없음) |
| `GET /llm-gateway/costs|breakers` | `/ai/llm-gateway/costs|breakers` (동기 프록시) |
| `GET /observability/*` | `/ai/observability/*` (동기 프록시) |

프론트 변경 범위: **`/qa/ask`, `/knowledge/documents` 두 곳만** 2-스텝(잡 발행 + SSE 구독) 방식으로 클라이언트 코드 수정이 필요하고, 나머지 엔드포인트는 베이스 URL과 인증 헤더 추가만으로 대응 가능.

---

## 3. 기술 스택 매핑 (v1 대비 변경/추가분만)

| 관심사 | 선택 |
|---|---|
| Gateway ↔ Kafka | `@nestjs/microservices`의 Kafka transport(`ClientKafka`) — 이미 `@nestjs/microservices`가 의존성에 존재, gRPC와 동일한 모듈 패턴으로 등록 |
| Python ↔ Kafka | `aiokafka` (asyncio 네이티브, FastAPI/asyncio 스택과 궁합) |
| 결과 릴레이 | Redis Streams — Gateway는 기존 `ioredis`(이미 `BullModule`에서 사용 중), Python은 `redis-py`(asyncio) |
| Gateway SSE | NestJS `@Sse()` 데코레이터(Observable 기반) 또는 raw `Response` 스트리밍 |
| 잡 메타데이터 | Redis Hash + TTL (`job:{jobId}`) |
| Python 웹 프레임워크(내부 API용) | FastAPI (v1 계획과 동일, 이제는 internal-only) |

이 외 Python 내부 스택(FastAPI, Motor, SQLAlchemy, LangChain Python 등)은 v1의 §2.1과 동일 — 변경 없음.

---

## 4. 모듈별 상세 계획 (v1 대비 변경분)

### 4.1 llm-gateway, prompt, observability
- 로직은 v1과 동일하게 이식(§3.1, §3.4 of v1 참조). **진입점만 변경**: `prompt`/`llm-gateway`/`observability`는 여전히 동기 HTTP 엔드포인트(내부 전용)로 남고, Gateway가 프록시한다.

### 4.2 knowledge
- 인제스트 트리거가 **Bull 큐 → Kafka 컨슈머**로 바뀐다. 청킹/임베딩/벡터 저장 로직(§3.2 of v1)은 동일하게 이식하되, 진입점이 `ingest.consumer.ts`(Bull) → `aiokafka` consumer로 바뀐다.
- 진행률 이벤트를 Redis Streams(`ai:job:{jobId}:events`)에 적재하는 훅을 새로 추가한다.

### 4.3 qa
- `AgenticAskUseCase`의 self-refine 루프(§3.3 of v1)는 로직 변경 없이 그대로 이식한다. **차이점은 출력 채널**: 기존에는 FastAPI `StreamingResponse`로 직접 SSE를 서빙했다면, 이제는 각 `yield` 지점마다 Redis Streams `XADD`를 호출하는 방식으로 바뀐다(내부적으로 async generator를 감싸는 얇은 어댑터 하나만 추가하면 됨 — 유스케이스 자체는 프레임워크 비의존 유지).
- 가드레일(`RagContentValidator`, `SecretPiiScanner`) 이식 및 검증 방침은 v1과 동일.

### 4.4 세션/잡 소유권 저장소
- 기존 `conversation-session.repository-impl.ts`(대화 세션)와 신규 `job:{jobId}` 메타데이터(잡 소유권)는 **서로 다른 개념**이다 — 전자는 QA 도메인의 대화 이력, 후자는 Gateway가 관리하는 인프라성 잡 라우팅 정보. 혼동하지 않도록 Redis 키 네임스페이스를 분리한다(`session:*` vs `job:*`).

---

## 5. Gateway 측 신규 구현 사항

`apps/gateway/src/ai/` 신규 모듈 (기존 `identity/`, `payment/`, `chat/`과 동일한 위치):

```
apps/gateway/src/ai/
├── ai-gateway.module.ts
├── kafka/
│   └── ai-kafka-producer.service.ts       # ClientKafka 래핑, jobId 키 발행
├── job/
│   ├── job-store.service.ts               # Redis Hash 잡 메타데이터 CRUD (소유권/TTL)
│   └── job.controller.ts                  # POST /ai/qa/jobs, POST /ai/knowledge/jobs
├── stream/
│   └── job-stream.controller.ts           # GET /ai/jobs/:jobId/stream (SSE, Redis Streams 릴레이)
└── proxy/
    └── ai-proxy.controller.ts             # /ai/prompts*, /ai/llm-gateway/*, /ai/observability/*, /ai/qa/sessions* 동기 프록시
```

- `job.controller.ts`, `job-stream.controller.ts`, `ai-proxy.controller.ts` 모두 `@UseGuards(GatewayAuthGuard)` 적용(기존 컨벤션과 동일하게 클래스 레벨 또는 라우트별 적용, 공개가 필요한 라우트는 없음 → `@Public()` 미사용).
- `job-stream.controller.ts`의 SSE 연결 처리는 chat gateway의 `handleConnection` 즉시 인증/즉시 종료 원칙을 그대로 따른다: 소유권 검증 실패 시 스트림을 열지 않고 즉시 403/404로 응답한다.

---

## 6. 마이그레이션 전략 — 단계적 전환 (Phase, v1 대비 재구성)

1. **Phase 0 — 인프라 준비** ✅ 프로젝트 스캐폴딩 완료
   - Python 프로젝트 경로: `public-project/public-python-server` (`public-server`, `public-front`, `public-infra`와 동일 레벨의 독립 프로젝트)
   - 스캐폴딩 구성: `pyproject.toml`(FastAPI/Motor/redis-py/aiokafka/SQLAlchemy/LangChain 등 §3 스택), Python 3.11, `src/ai_service/` 하위에 `knowledge`/`qa`/`prompt`/`llm_gateway`/`observability` 5개 모듈의 `presentation/application/domain/infrastructure` 4-레이어 골격, `shared_kernel`(`ValueObject`, `AggregateRoot`), `config/settings.py`(Pydantic Settings, 기존 `.ai-service.*.env` 키 매핑), `main.py`(FastAPI 앱 + `/health`), `Dockerfile`(python:3.11-slim), `.env.example`
   - 검증 완료: `pytest`(헬스체크 통과), `ruff check`, `mypy --strict` 모두 통과하는 상태로 커밋 가능
   - 남은 작업: Kafka 브로커(KRaft) + 토픽 프로비저닝을 `docker-compose.yml`에 추가(§8), Gateway에 `ClientKafka` 등록, Python에 `aiokafka` 컨슈머 스켈레톤, Redis Streams 릴레이 PoC(Gateway SSE ↔ 더미 Python 프로듀서 왕복 검증)

2. **Phase 1 — 동기 프록시 경로 우선 이식** ✅ Python 이식 완료 (Gateway `ai-proxy.controller.ts` 연동은 미착수)
   - llm-gateway/prompt/observability를 Python(FastAPI, internal-only)으로 이식 완료. `public-python-server/src/ai_service/{llm_gateway,prompt,observability}`에 각각 4-레이어(presentation/application/domain/infrastructure) 구조로 구현
   - llm-gateway: `LlmRoutingService`/`FallbackService`/`CostTrackingService`/`CircuitBreakerAdapter`(Redis)/`LlmCostLogRepositoryImpl`(Motor, `llm_cost_logs` 컬렉션 스키마 동일 유지)/`LangSmithTracingService`/5개 프로바이더(claude·openai·gemini·groq·ollama)를 감싸는 LangChain 기반 `ILlmProvider` 구현까지 전량 이식. `GET /llm-gateway/costs`, `GET /llm-gateway/breakers` 엔드포인트 동작
   - prompt: `PromptTemplate`/`PromptName` 도메인, 3개 유스케이스(생성/활성화/활성조회, 기본 프롬프트 폴백 포함), Motor 리포지토리(`prompt_templates` 컬렉션) 이식. 4개 REST 엔드포인트 동작
   - observability: `RagasEvalService`(휴리스틱 스코어링 + 선택적 LLM 평가) 및 Motor 리포지토리(`ragas_evaluations` 컬렉션) 이식. `GET /observability/ragas-evals`만 구현하고 `GET /observability/queues`는 Kafka 도입 전이라 Phase 2로 보류
   - 검증: 유닛 70개 중 59개(도메인/애플리케이션 로직, fake 리포지토리·LLM 프로바이더 사용) + 실제 로컬 MongoDB/Redis 대상 통합 테스트 11개 + FastAPI 라우터 e2e 테스트 7개 = 총 70개 테스트 통과, 라인 커버리지 85%(80% 기준 충족). `ruff`/`mypy --strict`/`black`/`isort`/`bandit` 전부 통과. `uvicorn`으로 실제 기동해 `/health` 및 7개 엔드포인트 OpenAPI 노출까지 스모크 검증
   - 미완료: Gateway(`apps/gateway`) 쪽 `ai-proxy.controller.ts` 프록시 연동은 아직 구현하지 않음 — 지금은 Python 서비스가 자체 포트에서 직접 서빙되는 상태(§5의 Gateway 신규 모듈 작업은 별도 착수 필요)

3. **Phase 2 — knowledge 잡 경로**
   - `POST /ai/knowledge/jobs` + Kafka(`ai.knowledge.ingest.requested`) + Redis Streams 릴레이 구현
   - 기존 Bull 큐(`ingest.consumer.ts`)와 병행 운영 후 Kafka 경로로 전환

4. **Phase 3 — qa 잡 경로 (최우선 리스크 관리 대상)**
   - `POST /ai/qa/jobs` + `GET /ai/jobs/:jobId/stream` 구현
   - §2.4의 SSE 프로토콜, Last-Event-ID 재생, 가드레일 회귀를 골든 테스트로 검증(§7.3)
   - 프론트(`AiService.tsx`)를 2-스텝 호출 방식으로 수정 — 이번 개정에서 유일하게 프론트 코드 변경이 필요한 지점

5. **Phase 4 — 트래픽 전환**
   - 프론트 API 베이스를 Gateway로 전환(카나리: 5→25→50→100%)
   - Python 서비스의 공개 포트(3004 상당)를 제거하고 내부 네트워크 전용으로 전환

6. **Phase 5 — 구 서비스 제거**
   - `apps/ai-service`(NestJS) 및 Bull 기반 인제스트/RAGAS 큐 코드 제거
   - `docs/ai-service.md` 갱신(Gateway 경유 API로 문서화)

---

## 7. 테스트 전략 (v1 대비 추가분)

### 7.1 신규 테스트 축
| 유형 | 대상 |
|---|---|
| Gateway 단위 테스트 | `JobStoreService`(소유권 TTL), `AiKafkaProducerService`(발행 페이로드) |
| 통합 테스트 | Kafka(testcontainers) — Gateway 발행 → Python 컨슈머 수신 왕복 |
| SSE 재연결 테스트 | Last-Event-ID로 스트림 중간부터 재생되는지 검증(연결 강제 종료 후 재연결 시나리오) |
| 인증/소유권 테스트 | 타 사용자의 `jobId`로 SSE 접근 시 403, 만료된 jobId 접근 시 404 |
| 멱등성 테스트 | 동일 Kafka 메시지 재전달(at-least-once 시뮬레이션) 시 중복 처리 없음 확인 |

### 7.2 기존 골든 테스트(청킹/RRF/가드레일 값 동일성)는 v1과 동일하게 유지 — 로직 자체는 변경되지 않았으므로 그대로 적용.

---

## 8. 인프라 변경 사항

- `docker-compose.yml`에 Kafka(KRaft 단일 노드로 충분, 운영 규모 확장 시 재검토) 서비스 추가, 토픽 초기화 스크립트(`kafka-topics --create ...`) 추가
- `ai-service` 컨테이너의 host 포트 매핑(`3004:3004`) 제거 — 내부 네트워크에서만 접근
- Gateway 컨테이너에 `KAFKA_BROKERS` 환경변수 추가
- 기존 `REDIS_DB_HOST/PORT`는 그대로 재사용(잡 메타데이터/Streams 용도로 DB 인덱스 또는 키 prefix만 구분 권장, 예: `ai:job:*`)

---

## 9. 리스크 및 완화 (v1 리스크 + 신규)

| 리스크 | 영향 | 완화 방안 |
|---|---|---|
| SSE 릴레이 중 Gateway 재시작 시 진행 중이던 스트림 전부 끊김 | 높음 | Redis Streams에 이미 적재된 이벤트는 유실되지 않으므로, 프론트 재연결 시 Last-Event-ID로 이어받기(§2.6). Gateway 다중 인스턴스 배포 시 특정 jobId 스트림을 어느 인스턴스가 릴레이해도 무방하도록 상태를 Gateway 프로세스가 아닌 Redis에만 둔다 |
| Kafka 컨슈머 처리 중 Python 프로세스 크래시 | 높음 | consumer group 재조정으로 다른 파드가 이어받되, 처리 상태를 Redis `job:{jobId}.status`로 관리해 중복/유실 판단(§2.5 멱등성) |
| jobId 소유권 검증 누락 시 타 사용자 응답 열람 가능 | 치명적 | §5의 `job-stream.controller.ts`에서 연결 시점 소유권 검증을 필수 게이트로 코드 리뷰 체크리스트에 명시, 보안 리뷰 통과 없이 Phase 3 배포 금지 |
| Kafka 신규 인프라 운영 부담(팀 경험 부재) | 중간 | 단일 브로커 KRaft로 최소 구성 시작, observability(§2.5의 completed 토픽)는 후순위로 미루고 requested 토픽 2개로 범위를 좁혀 시작 |
| 대용량 파일 업로드를 Kafka에 실어 브로커 부하 유발 | 중간 | §2.7에 명시한 대로 파일 바이너리는 Kafka에 태우지 않고 참조만 전달 |
| 프론트의 `/qa/ask` 단일 호출 → 2-스텝 호출 전환에 따른 프론트 회귀 | 중간 | Phase 3에서 e2e 테스트로 잡 발행→SSE 구독 전체 플로우 검증, 기존 v1 계획의 SSE 페이로드 골든 테스트 재사용 |

---

## 10. 마일스톤

| Phase | 내용 | 완료 기준 |
|---|---|---|
| 0 | Kafka/Redis Streams 인프라 PoC | Gateway↔Python 왕복 메시지 검증 |
| 1 | llm-gateway/prompt/observability 이식 + 동기 프록시 | 단위 테스트 대응, Gateway 프록시 정상 동작 |
| 2 | knowledge 잡 경로 | 업로드→Kafka→인제스트→SSE 진행률 E2E 통과 |
| 3 | qa 잡 경로 + 프론트 전환 | 골든 테스트+보안 리뷰 통과, 소유권 검증 테스트 통과 |
| 4 | 카나리 전환 | 트래픽 100%, Python 포트 비공개 전환 완료 |
| 5 | 구 서비스/큐 제거 | `apps/ai-service`(NestJS), Bull 인제스트/RAGAS 큐 삭제, 문서 갱신 |

---

## 11. 롤백 계획
- Phase 4 이전에는 v1 방식(Python 직접 노출)을 비활성화하지 않고 병행 가능하도록 Python 서비스의 host 포트를 유지한다 — 문제 발생 시 프론트 설정만 되돌리면 즉시 롤백.
- Phase 4에서 포트를 비공개로 전환한 이후의 롤백은 Gateway 라우팅을 원래 v1 대상(Python 직접 URL)으로 프론트가 되돌리는 대신, Gateway 경유 경로 자체의 이전 리비전으로 즉시 재배포하는 방식을 기본으로 한다(Python 서비스 재노출은 최후 수단).
- Kafka 토픽/컨슈머 그룹은 재배포와 무관하게 유지되므로, 롤백 시에도 큐에 쌓인 미처리 잡이 유실되지 않는다.
