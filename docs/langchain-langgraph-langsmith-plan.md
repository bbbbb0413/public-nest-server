# LangChain / LangGraph / LangSmith 적용 계획

> 현재 ai-service Phase 1–9 구현을 기반으로, 세 도구의 적용 가능 영역과 구체적인 구현 계획을 정리한다.

---

## 현황 요약

| 영역 | 현재 구현 | 개선 여지 |
|---|---|---|
| 텍스트 청킹 | `@langchain/textsplitters` — **이미 적용** | 없음 |
| LLM 호출 | `LlmGatewayService` (폴백/서킷브레이커/비용추적 커스텀) | 유지 권고 |
| Agentic RAG | `AgenticAskUseCase` — `for(;;)` 단순 루프 | LangGraph로 그래프화 |
| Critique 파싱 | regex `{[\s\S]*}` 추출 후 JSON.parse | LangChain structured output |
| RAGAS 평가 | 단어 겹침 휴리스틱 (LLM 기반 아님) | LangSmith evaluator |
| 트레이싱 | OTel GenAI 계측 | LangSmith 보완 |
| 프롬프트 관리 | DB 기반 버전관리 (`PromptTemplate` 도메인) | LangSmith Hub 연동 |

---

## Phase A — LangSmith 트레이싱 + RAGAS 평가 교체

**난이도**: 중 | **예상 작업**: 3–4일 | **우선순위**: 높음

### A-1. LangSmith 트레이싱 연동

현재 OTel GenAI 계측이 있지만 LLM-레이어 인사이트(프롬프트 변수, 체인 구조, 토큰 breakdown)가 부족하다.
LangSmith는 OTel과 **병렬** 운영한다 — OTel은 인프라 APM, LangSmith는 LLM 전용 가시성 담당.

#### 적용 대상 파일
- `apps/ai-service/src/llm-gateway/application/llm-gateway.service.ts`
- `apps/ai-service/src/qa/application/agentic-ask.use-case.ts`
- `apps/ai-service/src/qa/application/critique-generator.service.ts`

#### 구현 방법

```typescript
// apps/ai-service/src/main.ts — 부트스트랩에서 LangSmith 초기화
import { Client } from 'langsmith';

// env.example에 추가할 환경변수:
// LANGSMITH_TRACING=true
// LANGSMITH_API_KEY=<your-key>
// LANGSMITH_PROJECT=ai-service-prod
```

```typescript
// llm-gateway.service.ts — 스트림 호출에 run_id 전파
import { traceable } from 'langsmith/traceable';

// LlmGatewayService.stream()을 traceable로 감싸기
const traced = traceable(
  async (messages, promptName) => { /* 기존 로직 */ },
  { name: 'llm-gateway-stream', tags: ['rag', promptName] },
);
```

**주의**: `LlmGatewayService` 자체 폴백/서킷브레이커/비용 추적 로직은 **그대로 유지**한다. LangSmith는 관측 레이어만 추가한다.

#### 환경변수 추가 (env.example)
```
# ── LangSmith ────────────────────────────────────────────────────────────────
LANGSMITH_TRACING=false
LANGSMITH_API_KEY=
LANGSMITH_PROJECT=ai-service
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
```

---

### A-2. RAGAS 평가 교체 — LangSmith Evaluator

현재 `RagasEvalService`의 세 점수는 모두 휴리스틱이다.

```typescript
// 현재 (ragas-eval.service.ts:39) — 단어 겹침만 체크
const overlap = contexts.filter((c) =>
  answer.split(' ').some((word) => word.length > 2 && c.includes(word)),
).length;
```

LangSmith의 `evaluate()` API로 실제 LLM 기반 채점자를 사용한다.

#### 적용 대상 파일
- `apps/ai-service/src/observability/application/ragas-eval.service.ts`
- `apps/ai-service/src/observability/infrastructure/queue/ragas-eval.consumer.ts`

#### 구현 구조

```typescript
// ragas-eval.service.ts — LangSmith 평가자로 교체
import { Client } from 'langsmith';
import { evaluate } from 'langsmith/evaluation';

@Injectable()
export class RagasEvalService {
  private readonly langsmith = new Client();

  async evaluate(payload: RagasEvalPayload): Promise<void> {
    // 1. 데이터셋 예시 생성 (question → answer + contexts)
    const example = {
      inputs: { question: payload.question, contexts: payload.contexts },
      outputs: { answer: payload.answer },
    };

    // 2. LangSmith 내장 평가자 실행
    const result = await evaluate(
      () => payload.answer,
      {
        data: [example],
        evaluators: [
          faithfulnessEvaluator,    // LLM이 컨텍스트 기반 답변 여부 채점
          answerRelevancyEvaluator, // LLM이 질문-답변 관련성 채점
        ],
        client: this.langsmith,
        experimentPrefix: `ragas-${payload.traceId}`,
      },
    );

    // 3. 결과를 기존 MongoDB 컬렉션에 저장 (스키마 유지)
    await this.repo.persist({
      traceId: payload.traceId,
      question: payload.question,
      faithfulness: result.results[0]?.score ?? 0,
      answerRelevancy: result.results[1]?.score ?? 0,
      contextPrecision: this.fallbackContextPrecision(payload.contexts),
      sampledAt: new Date(),
    });
  }
}
```

**contextPrecision**은 LangSmith 공식 평가자가 아직 불안정하므로 기존 휴리스틱 유지 또는 커스텀 평가자 작성.

---

## Phase B — LangChain Structured Output (CritiqueGenerator)

**난이도**: 하 | **예상 작업**: 1일 | **우선순위**: 중

현재 `CritiqueGeneratorService`의 JSON 파싱이 regex 기반이라 LLM이 마크다운 코드블록이나 텍스트를 섞어 반환하면 깨진다.

#### 적용 대상 파일
- `apps/ai-service/src/qa/application/critique-generator.service.ts`

#### 구현 방법

```typescript
// critique-generator.service.ts — withStructuredOutput 적용
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';

const critiqueSchema = z.object({
  answered: z.boolean(),
  missing: z.array(z.string()),
  nextQuery: z.string(),
  confidence: z.number().min(0).max(1),
});

@Injectable()
export class CritiqueGeneratorService {
  private readonly structuredLlm: ReturnType<typeof model.withStructuredOutput>;

  constructor(private readonly llmGateway: LlmGatewayService) {
    const model = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
    this.structuredLlm = model.withStructuredOutput(critiqueSchema);
  }

  async generate(/* ... */): Promise<Critique> {
    try {
      const result = await this.structuredLlm.invoke(messages);
      return Critique.of(
        result.answered,
        result.missing,
        result.nextQuery,
        result.confidence,
      );
    } catch {
      return this.fallbackCritique();
    }
  }
}
```

**주의**: `withStructuredOutput`은 LlmGatewayService의 폴백/비용추적을 우회한다.
Critique 생성은 저비용 경량 모델(`gpt-4o-mini`)을 전용으로 사용하므로 별도 관리해도 무방하다.
단, 비용 추적이 필요하다면 LangSmith 트레이싱을 통해 토큰 사용량을 확인한다.

---

## Phase C — LangGraph로 AgenticAsk 그래프화

**난이도**: 상 | **예상 작업**: 1주 | **우선순위**: 중장기

현재 `AgenticAskUseCase`는 단순 `for(;;)` 루프다. 확장 시나리오(멀티 에이전트, Human-in-the-loop, 체크포인팅)가 생기면 복잡도가 폭발한다.

**시작 조건**: 멀티 에이전트 또는 Human-in-the-loop 기능이 실제로 필요해질 때.

### 그래프 설계

```
[START]
  ↓
[hybrid-search 노드]      — HybridSearchUseCase 위임
  ↓
[llm-stream 노드]         — LlmGatewayService 위임 (폴백/서킷브레이커 유지)
  ↓
[pii-mask 노드]           — SecretPiiScanner
  ↓
[critique 노드]           — CritiqueGeneratorService (withStructuredOutput)
  ↓
[라우터 조건부 엣지]
  ├─ satisfied → [END: 스트림 출력]
  ├─ budget-exhausted → [END: 강제 출력]
  ├─ low-confidence → [human-review 노드] (Human-in-the-loop)
  └─ retry → [query-refine 노드] → [hybrid-search 노드]
```

### 상태 타입

```typescript
import { Annotation } from '@langchain/langgraph';
import { IterationBudget } from '../../domain/vo/iteration-budget.vo';
import { Critique } from '../../domain/vo/critique.vo';

const AgenticState = Annotation.Root({
  originalQuestion: Annotation<string>,
  currentQuery:     Annotation<string>,
  chunks:           Annotation<SimilaritySearchResult[]>,
  lastAnswer:       Annotation<string>,
  critique:         Annotation<Critique | null>,
  iteration:        Annotation<number>,
  tokensUsed:       Annotation<number>,
  startTime:        Annotation<number>,
  budget:           Annotation<IterationBudget>,
  confidenceThreshold: Annotation<number>,
  tenant:           Annotation<string>,
});
```

### 레이어 정합성 유지

- LangGraph 노드 구현은 **infrastructure 레이어** (`qa/infrastructure/graph/`)에 위치
- `AgenticAskUseCase` (application 레이어)는 그래프 포트 인터페이스(`IAgenticGraph`)에만 의존
- 도메인 VO (`IterationBudget`, `Critique`)는 그대로 재사용

```
qa/
├── application/
│   └── agentic-ask.use-case.ts      ← IAgenticGraph 포트에 의존 (변경 최소)
├── domain/
│   └── port/
│       └── agentic-graph.port.ts    ← 새 포트 추가
└── infrastructure/
    └── graph/
        ├── agentic-rag.graph.ts     ← LangGraph StateGraph 구현
        └── nodes/
            ├── hybrid-search.node.ts
            ├── llm-stream.node.ts
            ├── pii-mask.node.ts
            ├── critique.node.ts
            └── query-refine.node.ts
```

---

## 도입 순서 요약

```
Phase A (즉시)
  A-1. LangSmith 트레이싱 — env 추가 + traceable 래핑
  A-2. RAGAS 평가 교체 — ragas-eval.service.ts 교체

Phase B (단기, 1~2주 내)
  B-1. Structured Output — critique-generator.service.ts 교체

Phase C (중장기, 멀티 에이전트 필요 시)
  C-1. LangGraph 그래프 인프라 추가
  C-2. AgenticAskUseCase → IAgenticGraph 포트 위임
```

---

## 패키지 추가 목록

```bash
# Phase A
pnpm add langsmith                         # 트레이싱 + 평가

# Phase B
pnpm add @langchain/openai                 # withStructuredOutput
pnpm add zod                               # structured output 스키마 (이미 있을 가능성 높음)

# Phase C
pnpm add @langchain/langgraph              # 그래프 오케스트레이션
pnpm add @langchain/core                   # Annotation, BaseMessage 등
```

> `@langchain/textsplitters`는 이미 `IngestDocumentUseCase`에서 사용 중이다.

---

## 변경하지 않는 것

| 컴포넌트 | 이유 |
|---|---|
| `LlmGatewayService` | 폴백 체인, 서킷브레이커, 비용 추적이 LCEL로 대체 불가 |
| `HybridSearchUseCase` | RRF + HyDE + 리랭킹 커스텀 구현이 LangChain retriever보다 세밀 |
| `PromptTemplate` 도메인 | DB 기반 버전관리가 이미 완비. LangSmith Hub는 선택 사항 |
| DDD 4-레이어 아키텍처 | LangGraph는 infrastructure 레이어에 격리, domain 레이어 불변 |
| OTel 계측 | LangSmith와 병렬 운영. 인프라 APM은 OTel이 담당 |
