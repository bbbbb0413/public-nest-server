# AI 서비스 기능 완성도 분석 및 개선 방안

> 작성일: 2026-06-25  
> 분석 대상: `apps/ai-service` (백엔드) + `public-front/src` (프론트엔드)  
> 분석 범위: Phase 4–9 구현 이후 현재 상태 점검

---

## 1. 분석 요약

Phase 4–9(시맨틱 캐싱 · 보안 가드레일 · 하이브리드 검색 · LLM 게이트웨이 · OTel · Agentic RAG)가 백엔드에 구현됐지만, **프론트엔드가 이 기능들을 제대로 활용하지 못하고** 있고, 백엔드 자체에도 Silent 버그와 기능 미완성 지점이 다수 존재한다.

### 심각도 분류

| 심각도 | 설명 |
|--------|------|
| 🔴 CRITICAL | 기능 완전 불작동 또는 보안 취약점 |
| 🟠 HIGH | 주요 기능 저하, 잘못된 데이터 |
| 🟡 MEDIUM | UX 저하, 기능 미완성 |
| 🟢 LOW | 편의성 개선 |

---

## 2. 백엔드 버그 및 미완성 항목

### 2-1. 🔴 [CRITICAL] Critique 폴백 신뢰도 버그

**파일**: `apps/ai-service/src/qa/application/critique-generator.service.ts`

**현상**: `fallbackCritique()` 가 `confidence = 0.5`를 반환한다. 기본 신뢰도 임계값이 `0.6`이므로, critique JSON 파싱에 실패할 때마다 조건 미충족으로 판정돼 **불필요한 Agentic 루프 2차 반복이 강제 실행**된다.

**원인 코드**:
```typescript
// critique-generator.service.ts
private fallbackCritique(): Critique {
  return Critique.of(false, [], '', 0.5); // 0.5 < threshold(0.6) → 항상 재반복
}
```

**영향**: OpenAI API 키 없는 환경에서 항상 2회 반복 → 응답 지연 최대 2배. critique 모델이 JSON을 잘 못 만들 때도 동일하게 발생.

**수정 방향**:
```typescript
// 파싱 실패 = 답변 가능 여부 불명 → 임계값 이상의 보수적 기본값 사용
private fallbackCritique(): Critique {
  // answered=true, confidence=0.7: 재반복 없이 첫 번째 답변을 그대로 사용
  return Critique.of(true, [], '', 0.7);
}
```

---

### 2-2. 🟠 [HIGH] promptTokens 항상 0 — 비용 추적 부정확

**파일**: `apps/ai-service/src/llm-gateway/application/llm-gateway.service.ts`

**현상**: `CostTrackingService`가 completionTokens만 카운트하고 promptTokens는 0으로 고정해 기록한다. 실제 LLM 비용의 약 30–50%를 차지하는 프롬프트 입력 비용이 완전히 누락된다.

**영향**: 비용 대시보드(`/llm-gateway/costs`)가 실제 API 비용의 절반 이하만 표시. 비용 예산 판단 오류.

**수정 방향**: 스트리밍 완료 후 프롬프트 메시지 길이로 토큰 수 추정 (정확값은 tiktoken 라이브러리 또는 응답 헤더 `x-ratelimit-tokens` 활용):
```typescript
// 스트리밍 전 프롬프트 토큰 추정 (chars / 4 ≈ tokens, GPT 기준)
const estimatedPromptTokens = messages.reduce(
  (sum, m) => sum + Math.ceil(m.content.length / 4), 0
);
await this.costTracker.record({
  promptTokens: estimatedPromptTokens,
  completionTokens: collected.length,
  // ...
});
```

---

### 2-3. 🔴 [CRITICAL] Knowledge 컨트롤러 인증 없음

**파일**: `apps/ai-service/src/knowledge/presentation/knowledge.controller.ts`

**현상**: `@UseGuards()` 데코레이터가 없다. 누구든 인증 없이 문서 업로드·삭제가 가능하다.

```typescript
// 현재 (취약)
@Controller('knowledge/documents')
export class KnowledgeController {
  @Post() async upload(@UploadedFile() file: Express.Multer.File) { ... }
  @Delete(':id') async delete(@Param('id') id: string) { ... }
}
```

**수정 방향**: 최소한 admin 토큰 가드를 적용:
```typescript
@UseGuards(AdminAuthGuard)  // 추가
@Controller('knowledge/documents')
export class KnowledgeController { ... }
```

---

### 2-4. 🟡 [MEDIUM] HyDE 항상 비활성화 (하드코딩)

**파일**: `apps/ai-service/src/qa/presentation/qa.controller.ts`

**현상**: `HyDE`(Hypothetical Document Embeddings) 서비스가 구현되어 있지만 컨트롤러에서 항상 `false`로 하드코딩되어 있다.

```typescript
// qa.controller.ts (현재)
const result = await this.hybridSearch.execute(
  new HybridSearchCommand(question, topK, false), // useHyde 항상 false
);
```

**수정 방향**: 짧은 질의(단어 3개 이하)에서 자동으로 HyDE 활성화:
```typescript
const wordCount = question.split(/\s+/).length;
const useHyde = dto.useHyde ?? wordCount <= 3;
new HybridSearchCommand(question, topK, useHyde)
```

---

### 2-5. 🟡 [MEDIUM] Agentic 루프 2번째 반복 단일 청크로 전달

**파일**: `apps/ai-service/src/qa/application/agentic-ask.use-case.ts`

**현상**: 1번째 반복은 토큰 단위로 스트리밍되지만, 2번째 반복 이상의 답변은 `streamFromString()`으로 전달 — 전체 텍스트를 모아서 한 번에 보낸다. 사용자 입장에서 1번째 반복 답변이 나오고 나서 추가 답변이 갑자기 통째로 나타나는 UX.

**수정 방향**: 모든 반복에서 토큰 단위 스트리밍을 적용하고, critique 통과 시점에서 최종 답변만 yield:
```typescript
for await (const token of this.llmGateway.stream(...)) {
  collected.push(token);
  yield this.secretPiiScanner.mask(token); // 모든 반복에서 스트리밍
}
```

---

### 2-6. 🟡 [MEDIUM] RAGAS 평가 결과 조회 API 없음

**파일**: `apps/ai-service/src/observability/`

**현상**: `RagasEvalService`가 평가 결과를 MongoDB `ragas_evaluations` 컬렉션에 저장하지만, 이를 조회할 컨트롤러/API 엔드포인트가 없다. 프론트엔드 어드민에서 평가 점수를 볼 수 없다.

**수정 방향**: `GET /admin/ragas-evaluations?from=&to=` 엔드포인트 추가:
```typescript
@Controller('admin/ragas-evaluations')
@UseGuards(AdminAuthGuard)
export class RagasEvalController {
  @Get()
  async list(@Query('from') from: string, @Query('to') to: string) {
    return this.ragasEvalService.listEvaluations(new Date(from), new Date(to));
  }
}
```

---

### 2-7. 🟢 [LOW] RAGAS 휴리스틱 점수 역방향 버그

**파일**: `apps/ai-service/src/observability/application/ragas-eval.service.ts`

**현상**: 휴리스틱 `scoreContextPrecision()` 구현이 컨텍스트 수가 적을수록 높은 점수를 준다.
```typescript
// 현재 (버그)
return Math.min(1, 1 / contexts.length + 0.5);
// contexts=1 → 1.5 → clamp → 1.0 (최고점)
// contexts=5 → 0.7 (낮은 점수)
// 컨텍스트가 적을수록 정밀도가 높다는 역방향 로직
```

RAGAS Context Precision의 정의는 "검색된 컨텍스트 중 실제로 답변에 사용된 비율"이다. 컨텍스트 수만으로 계산하면 의미없는 수치다.

**수정 방향**: 휴리스틱이면 최소한 `0.5` 고정값을 반환해 잘못된 지표를 노출하지 않거나, LLM 기반 평가(`RAGAS_LLM_EVAL_ENABLED=true`)를 기본으로 설정.

---

## 3. 프론트엔드 미연동 항목

### 3-1. 🔴 [CRITICAL] userId 미전달 — 사용자별 프롬프트 불작동

**파일**: `src/api/ai.ts` → `askQuestionStream()`

**현상**: 백엔드 `/qa/ask` API가 `userId`를 받아 사용자별 커스텀 프롬프트를 적용하는 기능을 지원하지만, 프론트엔드에서 `userId`를 요청 바디에 포함하지 않는다.

```typescript
// 현재 (ai.ts)
body: JSON.stringify({ question }), // userId 없음
```

**영향**: `PromptManagement`에서 사용자별 프롬프트(`createUserPrompt`)를 만들어도 실제 QA에서 절대 적용되지 않는다.

**수정 방향**:
```typescript
// ai.ts
export async function askQuestionStream(
  question: string,
  userId: string | null,
  onMessage: (msg: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
) {
  body: JSON.stringify({ question, ...(userId && { userId }) }),
```

```tsx
// AiService.tsx
const { user } = useAuth();
askQuestionStream(question, user?.id ?? null, onMessage, onDone, onError);
```

---

### 3-2. 🟠 [HIGH] 마크다운 렌더링 없음

**파일**: `src/components/AiService.tsx`

**현상**: AI 응답이 plain text로 표시된다. 백엔드가 마크다운 포맷(헤더, 목록, 코드블록)으로 답변을 생성해도 UI에서 원문 기호(`#`, `**`, `` ` ``)가 그대로 노출된다.

**수정 방향**: `react-markdown` 패키지를 추가해 스트리밍 누적 텍스트를 렌더링:
```tsx
import ReactMarkdown from 'react-markdown';

<div className="ai-response">
  <ReactMarkdown>{streamedAnswer}</ReactMarkdown>
</div>
```

---

### 3-3. 🟠 [HIGH] 문서 인제스트 진행 상태 미갱신

**파일**: `src/components/AiService.tsx`

**현상**: 파일 업로드 후 `202 Accepted` 응답을 받으면 비동기 처리가 시작되지만, UI는 상태 갱신을 폴링하지 않는다. 사용자가 수동으로 새로고침하지 않으면 `PENDING` 상태로 영원히 표시된다.

**수정 방향**: 업로드 성공 후 3초 간격으로 폴링, 모든 문서가 `COMPLETED` 또는 `FAILED` 상태가 되면 중단:
```tsx
const pollUntilComplete = (uploadedDocId: string) => {
  const interval = setInterval(async () => {
    const docs = await getDocuments();
    setDocuments(docs);
    const doc = docs.find(d => d.id === uploadedDocId);
    if (!doc || doc.status === 'COMPLETED' || doc.status === 'FAILED') {
      clearInterval(interval);
    }
  }, 3000);
};
```

---

### 3-4. 🟠 [HIGH] 대화 컨텍스트 없음 — 단일 턴 Q&A

**파일**: `src/components/AiService.tsx` + `src/api/ai.ts`

**현상**: 각 질문이 독립적인 단일 턴 요청으로 전송된다. "방금 설명한 기능의 장점은 뭐야?"처럼 이전 대화를 참조하는 후속 질문이 불가능하다.

**수정 방향**: 채팅 히스토리를 배열로 관리하고 요청 바디에 포함:
```typescript
// api/ai.ts
body: JSON.stringify({
  question,
  userId,
  conversationHistory: history.slice(-6), // 최근 6턴만
}),
```

백엔드 `AskCommand`에 `conversationHistory?: Array<{role: string; content: string}>` 추가 후 LLM 메시지 빌드 시 prepend.

---

### 3-5. 🟡 [MEDIUM] LlmMonitor 자동 갱신 없음

**파일**: `src/components/admin/LlmMonitor.tsx`

**현상**: LLM 비용 대시보드와 Circuit Breaker 상태가 수동 새로고침 시에만 업데이트된다. Circuit Breaker가 OPEN 상태로 전환돼도 관리자가 알아채기 어렵다.

**수정 방향**: 30초 자동 폴링 추가:
```tsx
useEffect(() => {
  fetchData();
  const interval = setInterval(fetchData, 30_000);
  return () => clearInterval(interval);
}, []);
```

---

### 3-6. 🟡 [MEDIUM] QueuePanel AI 인제스트와 무관

**파일**: `src/components/admin/QueuePanel.tsx`

**현상**: `POST /queue/add`로 일반 큐 작업을 제출하는 범용 패널이다. AI 문서 인제스트(`ingest` 큐), RAGAS 평가(`ragas-eval` 큐)의 상태를 모니터링하거나 실패 작업을 재시도하는 AI 전용 기능이 없다.

**수정 방향**: AI 전용 큐 모니터 컴포넌트 추가:
- `GET /queue/ingest/stats` — 대기/진행/완료/실패 수
- `GET /queue/ingest/jobs?status=failed` — 실패 작업 목록
- `POST /queue/ingest/jobs/:id/retry` — 재시도

---

### 3-7. 🟡 [MEDIUM] RAGAS 평가 대시보드 없음

**파일**: `src/components/admin/PromptManagement.tsx`

**현상**: 프롬프트 버전을 활성화해도 해당 프롬프트가 얼마나 좋은 답변을 내는지 RAGAS 점수로 확인할 수 없다. 평가 점수 없이 프롬프트를 블라인드로 선택해야 한다.

**수정 방향**: `PromptManagement`에 RAGAS 점수 섹션 추가:
```tsx
const { data: evalResults } = useRagasEvaluations({ from, to });

<RagasScoreChart
  faithfulness={evalResults.avgFaithfulness}
  answerRelevancy={evalResults.avgAnswerRelevancy}
  contextPrecision={evalResults.avgContextPrecision}
/>
```

---

### 3-8. 🟢 [LOW] 응답 출처(Citations) 미표시

**파일**: `src/components/AiService.tsx`

**현상**: 백엔드 RAG 파이프라인이 어느 문서 청크에서 컨텍스트를 가져왔는지 알고 있지만, 이 정보가 프론트엔드로 전달되지 않는다. 사용자는 AI 답변이 어느 문서 기반인지 확인 불가.

**수정 방향**: SSE 스트림 마지막에 출처 메타데이터를 포함하는 별도 이벤트 전송:
```typescript
// 백엔드 qa.controller.ts — 스트리밍 완료 후
res.write(`event: sources\ndata: ${JSON.stringify(sources)}\n\n`);
```
```tsx
// 프론트엔드 — sources 이벤트 수신 후 표시
<div className="sources">
  {sources.map(s => <a href={`#doc-${s.documentId}`}>{s.fileName}</a>)}
</div>
```

---

## 4. 개선 우선순위 로드맵

### Phase A — 즉시 수정 (1–2일, 버그 픽스)

| # | 항목 | 파일 | 예상 공수 |
|---|------|------|---------|
| A1 | fallbackCritique confidence 0.5 → 0.7 수정 | `critique-generator.service.ts` | 5분 |
| A2 | promptTokens 추정값 기록 | `llm-gateway.service.ts` | 30분 |
| A3 | Knowledge 컨트롤러 AdminAuthGuard 적용 | `knowledge.controller.ts` | 15분 |
| A4 | RAGAS 휴리스틱 점수 버그 수정 | `ragas-eval.service.ts` | 15분 |

### Phase B — 프론트엔드 연동 (3–5일)

| # | 항목 | 파일 | 예상 공수 |
|---|------|------|---------|
| B1 | userId 요청 바디 포함 | `ai.ts`, `AiService.tsx` | 1시간 |
| B2 | 마크다운 렌더링 (react-markdown) | `AiService.tsx` | 2시간 |
| B3 | 인제스트 상태 폴링 | `AiService.tsx` | 3시간 |
| B4 | LlmMonitor 자동 새로고침 (30초) | `LlmMonitor.tsx` | 1시간 |

### Phase C — 기능 완성 (1–2주)

| # | 항목 | 구성 요소 | 예상 공수 |
|---|------|----------|---------|
| C1 | RAGAS 조회 API + 어드민 대시보드 | BE 컨트롤러 + FE 컴포넌트 | 2일 |
| C2 | 대화 히스토리 (multi-turn) | BE command + FE 상태 관리 | 3일 |
| C3 | AI 큐 모니터링 패널 | BE 큐 API + FE 컴포넌트 | 2일 |
| C4 | HyDE 자동 활성화 (짧은 질의) | `qa.controller.ts` | 2시간 |
| C5 | 응답 출처(Citations) 표시 | BE SSE + FE UI | 1일 |
| C6 | Agentic 2차 반복 스트리밍 | `agentic-ask.use-case.ts` | 2시간 |

---

## 5. 파일별 변경 영향 요약

### 백엔드

| 파일 | 심각도 | 변경 내용 |
|------|--------|---------|
| `qa/application/critique-generator.service.ts` | 🔴 | fallbackCritique confidence 0.5 → 0.7 |
| `llm-gateway/application/llm-gateway.service.ts` | 🟠 | promptTokens 추정 계산 추가 |
| `knowledge/presentation/knowledge.controller.ts` | 🔴 | AdminAuthGuard 적용 |
| `observability/application/ragas-eval.service.ts` | 🟢 | scoreContextPrecision 로직 수정 |
| `qa/presentation/qa.controller.ts` | 🟡 | useHyde 조건부 활성화 |
| `observability/presentation/ragas-eval.controller.ts` | 🟡 | 신규 생성 — 평가 결과 조회 API |
| `qa/application/agentic-ask.use-case.ts` | 🟡 | 2차 반복 토큰 단위 스트리밍 |

### 프론트엔드

| 파일 | 심각도 | 변경 내용 |
|------|--------|---------|
| `src/api/ai.ts` | 🔴 | userId, conversationHistory 요청 포함 |
| `src/components/AiService.tsx` | 🟠 | 마크다운 렌더링, 상태 폴링, userId 주입 |
| `src/components/admin/LlmMonitor.tsx` | 🟡 | 자동 새로고침 (30초) |
| `src/components/admin/PromptManagement.tsx` | 🟡 | RAGAS 점수 섹션 추가 |
| `src/components/admin/AiQueuePanel.tsx` | 🟡 | 신규 생성 — AI 전용 큐 모니터 |

---

## 6. 기술 부채 메모

- **테스트 커버리지 없음**: `apps/ai-service` 내 `*.spec.ts` 파일이 거의 없다. Phase A–C 수정 시 단위 테스트 병행 작성 필수 (목표 80%).
- **멀티테넌시 미활용**: 프론트엔드에서 `tenant` 파라미터를 전달하지 않아 모든 쿼리가 `default` 테넌트로 처리된다.
- **인증 헤더 불일치**: `aiAdmin.ts`는 Bearer 토큰을 사용하지만 `ai.ts`는 인증 헤더가 없다. 일관된 인증 전략 수립 필요.
