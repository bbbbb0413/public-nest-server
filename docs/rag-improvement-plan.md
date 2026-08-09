# RAG 파이프라인 개선 계획

> 최초 작성: 2026-07-19 | 최종 업데이트: 2026-07-20  
> 대상 서비스: `apps/ai-service`  
> 분석 범위: 현재 구현된 코드의 버그 및 정확도 결함 (미래 기능 추가 계획은 `ai-service-feature-improvements-plan.md` 참고)

---

## 목차

1. [버그 — 즉시 수정](#1-버그--즉시-수정)
2. [청킹 파이프라인 개선](#2-청킹-파이프라인-개선)
3. [검색 정확도 개선](#3-검색-정확도-개선)
4. [질의 처리 개선](#4-질의-처리-개선)
5. [LLM 응답 품질 개선](#5-llm-응답-품질-개선)
6. [우선순위 요약](#6-우선순위-요약)

---

## 1. 버그 — 즉시 수정

### 1-0. 회사/프로젝트 헤더 맥락 단절 (청크 분리 구조적 결함)

**파일**: `apps/ai-service/src/knowledge/application/ingest-document.use-case.ts`  
**심각도**: 높음 — 답변 내용 불일치의 직접 원인

**문제**  
MongoDB 분석 결과 (`knowledge_chunks` 컬렉션, 2026-07-20 기준):

| 청크 | parentChunkId | 내용 | "위메이드플레이" 포함? |
|------|---------------|------|----------------------|
| chunk 7 | `52e17856` | "경력 5년 7개월 **주식회사 위메이드플레이** 2022..." | TEXT에 있음 |
| chunk 8 | `52e17856` | "-- 2 of 10 --" (페이지 구분자) | parentText에만 |
| chunks 9-12 | `15f4a219` | 채팅 마이크로서비스 상세 (gRPC, SSE, Socket.IO...) | **없음** |
| chunks 13-14 | `386c026e` | Append-only 설계, Pub/Sub 성능... | **없음** |

회사명이 있는 청크 7과 실제 프로젝트 상세(청크 9-14)가 **다른 parentChunkId**에 속한다. chunks 9-14의 `parentText` 어디에도 "위메이드플레이"라는 단어가 없다.

결과적으로:
- 벡터 검색이 채팅 마이크로서비스 상세 청크를 올바르게 반환해도
- LLM에 전달되는 컨텍스트에는 "이게 위메이드플레이 프로젝트입니다"라는 정보가 전혀 없음
- LLM이 자체 지식으로 보완하거나 전혀 다른 내용으로 답변 생성

**수정 방향**

청크 생성 시 각 child 청크의 `parentText`에 **섹션 헤더(회사명, 기간, 프로젝트명)**를 접두사로 삽입:

```typescript
// ingest-document.use-case.ts — buildVectorDocs() 내부
// 현재: parentText = parent 청크 원문
// 수정: 섹션 헤더를 감지해서 parentText 앞에 접두

private extractSectionHeader(text: string): string | null {
  // "주식회사 OOO 2022.03 ~ 2024.04" 형태 헤더 탐지
  const match = text.match(
    /(?:주식회사|㈜)?\s*([^\n]+?)\s+(\d{4})\.\d{2}\s*[~\-]\s*(?:\d{4}\.\d{2}|현재)/,
  );
  return match ? match[0].trim() : null;
}

// parentText 구성 시
const header = this.extractSectionHeader(parentChunk.pageContent);
const prefixedParentText = header
  ? `[${header}]\n${parentChunk.pageContent}`
  : parentChunk.pageContent;
```

또는 단기 대안: 이력서를 재업로드 시 회사명을 각 프로젝트 세부 항목 앞에 수동 삽입.

---

### 1-1. 텍스트 검색 결과 — `parentChunkId` 누락

**파일**: `apps/ai-service/src/qa/infrastructure/search/mongo-text-search.adapter.ts:7-12`  
**심각도**: 높음

**문제**  
`ChunkRecord` 인터페이스와 MongoDB projection에 `parentChunkId` / `parentText` 필드가 없다. 텍스트 검색으로 반환된 청크는 `metadata.parentChunkId`가 항상 `undefined`라서 `expandWithSiblings()`에서 걸러진다.

```typescript
// hybrid-search.use-case.ts:119
.filter((c) => c.metadata.parentChunkId)  // 텍스트 검색 결과 전부 제외됨
```

하이브리드 검색의 절반(렉시컬 경로)이 sibling 확장 혜택을 받지 못하고, 짧은 child 텍스트(256자)만 LLM에 전달된다.

**수정 내용**

```typescript
// mongo-text-search.adapter.ts

interface ChunkRecord {
  text: string;
  documentId: string;
  fileName: string;
  chunkIndex: number;
  parentChunkId?: string;  // 추가
  parentText?: string;     // 추가
}

// search() 메서드 projection 수정
.project<ChunkRecord & { score: number }>({
  text: 1,
  documentId: 1,
  fileName: 1,
  chunkIndex: 1,
  parentChunkId: 1,  // 추가
  parentText: 1,     // 추가
  score: { $meta: 'textScore' },
})

// 반환 map 수정
return results.map((r) => ({
  text: r.text,
  score: (r as ChunkRecord & { score?: number }).score ?? 0,
  metadata: {
    documentId: r.documentId,
    fileName: r.fileName,
    chunkIndex: r.chunkIndex,
    ...(r.parentChunkId && { parentChunkId: r.parentChunkId }),
    ...(r.parentText && { parentText: r.parentText }),
  },
}));
```

---

### 1-2. `agentic-ask` — `parentText` 미사용

**파일**: `apps/ai-service/src/qa/application/agentic-ask.use-case.ts`  
**심각도**: 중간

**문제**  
`ask.use-case.ts`는 LLM 컨텍스트 구성 시 `c.metadata.parentText ?? c.text`(parent 우선)를 사용한다(`ask.use-case.ts:222`). 반면 `agentic-ask.use-case.ts`는 `c.text`(child만)를 사용한다. Agentic 경로에서 짧은 256자 child가 LLM에 전달되어 답변 품질이 저하된다. parent 단위 중복 제거도 누락되어 있다.

**수정 내용**  
`agentic-ask.use-case.ts`의 `buildMessages()` context 구성 부분을 `ask.use-case.ts:208-224`와 동일한 패턴으로 통일한다:
- `parentText ?? c.text` 우선 사용
- `seenParents` Map으로 parent 단위 중복 제거 적용

---

## 2. 청킹 파이프라인 개선

**파일**: `apps/ai-service/src/knowledge/application/ingest-document.use-case.ts`

### 2-1. PDF 텍스트 추출기 교체

**현재**: `pdf-parse` — PDF 텍스트 스트림을 순서대로 단순 연결  
**문제**: 다단 레이아웃, 표, 헤더/푸터, 각주가 본문과 섞여 의미 없는 텍스트 생성

실제 발생 현상:

| PDF 구조 | pdf-parse 추출 결과 |
|---------|-----------------|
| 2단 레이아웃 | 왼쪽/오른쪽 컬럼 텍스트가 줄 단위로 교차 혼합 |
| 표(Table) | 셀이 행/열 순서 없이 나열: "서울 강남구 부산 해운대구..." |
| 반복 헤더 | 페이지마다 "2024 연간보고서 \| 3부"가 본문에 삽입 |
| 각주 | 본문 문장 중간에 각주 번호+내용 삽입 |

**개선 방향**

| 라이브러리 | 장점 | 단점 |
|-----------|------|------|
| `pdfjs-dist` (PDF.js) | 페이지 단위 텍스트 + 좌표 제공, 컬럼 재구성 가능 | 구현 복잡도 증가 |
| `pdf2json` | 페이지/단락 구조 보존 | 표 처리 한계 |
| `unstructured` (Python API) | 표·섹션 구조 인식, 고품질 | Python 사이드카 필요 |

최소 개선: `pdfjs-dist`로 교체 후 페이지 단위 텍스트 추출. 페이지 구분자(`\f`)는 현행 유지.

추가로 헤더/푸터 반복 패턴 제거 로직 필요: 각 페이지 상단 10% / 하단 10% 텍스트를 3페이지 이상 반복되는 경우 제거.

---

### 2-2. 의미 경계 기반 청킹

**현재** (`ingest-document.use-case.ts:34-45`):  
`RecursiveCharacterTextSplitter`는 chunkSize(문자 수)에 도달할 때만 separator를 탐색한다. 단락/섹션 경계와 무관하게 1024자에서 잘린다.

**문제**: 1024자 안에 두 주제가 섞이고, 단락 경계가 있어도 chunkSize에 도달하지 않으면 청크를 나누지 않는다.

**개선 방향**

1차 개선 (단락 우선 분할):  
`\f` / `\n\n` 기준으로 먼저 단락을 나눈 뒤, 단락이 chunkSize를 초과할 때만 문장 단위로 추가 분할한다.

```typescript
private async splitByParagraphFirst(text: string): Promise<string[]> {
  const segments = text.split(/\f|\n\n/).filter((s) => s.trim().length > 0);
  const chunks: string[] = [];
  let current = '';

  for (const seg of segments) {
    const joined = current ? `${current}\n\n${seg}` : seg;
    if (joined.length > 1024 && current) {
      chunks.push(current.trim());
      current = seg;
    } else {
      current = joined;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}
```

2차 개선 (semantic chunking):  
인접 문장 간 임베딩 코사인 유사도가 임계값 이하로 떨어지면 청크를 분리한다. 인제스트 비용이 증가하지만 청크 품질이 근본적으로 개선된다. `@langchain/textsplitters`의 `SemanticChunker` 활용 검토.

---

### 2-3. 한국어 종결어미 separator 보완

**현재** (`ingest-document.use-case.ts:26`):
```typescript
const KOREAN_SENTENCE_ENDINGS = ['다. ', '요. ', '까. ', '죠. ', '나. '];
```

**누락된 종결어미**: `데. `, `네. `, `군. `, `음. `, `지. `, `야. `, `아. `, `어. `, `고. `, `며. `, `고요. `, `네요. `, `데요. `

**수정 내용**:
```typescript
const KOREAN_SENTENCE_ENDINGS = [
  '다. ', '요. ', '까. ', '죠. ', '나. ',
  '데. ', '네. ', '군. ', '음. ', '지. ',
  '야. ', '아. ', '어. ', '고. ', '며. ',
  '고요. ', '네요. ', '데요. ',
];
```

---

### 2-4. Child 청크 크기 조정

**현재**: child 256자 / parent 1024자

**문제**: 한국어 256자 ≈ 100-130 토큰. `text-embedding-3-small`, BGE 계열 임베딩 모델의 optimal range(256-512 토큰)에 크게 못 미쳐 임베딩 벡터에 담기는 의미 정보가 부족하다.

또한 parent(1024자) overlap 200자 때문에 인접 parent 사이의 child들이 동일 텍스트를 다른 `parentChunkId`로 중복 저장한다.

**개선 방향**:

```typescript
// 변경 후
private readonly parentSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1536,   // 1024 → 1536
  chunkOverlap: 300, // 200 → 300
  separators: ['\f', '\n\n', '\n', ...KOREAN_SENTENCE_ENDINGS, ' ', ''],
});

private readonly childSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,    // 256 → 512
  chunkOverlap: 100, // 50 → 100
  separators: ['\n\n', '\n', ...KOREAN_SENTENCE_ENDINGS, ' ', ''],
});
```

주의: 청크 크기 변경 시 기존 인제스트 데이터를 재처리해야 한다. 스테이징에서 검색 정확도 A/B 측정 후 적용.

---

### 2-5. Contextual Prefix — 문서 샘플링 개선

**현재** (`ingest-document.use-case.ts:183-184`):
```typescript
const docSample = fullText.substring(0, 400);  // 항상 문서 앞부분만
const chunkSample = chunkText.substring(0, 200);
```

**문제**: 100페이지 문서의 80페이지 청크도 문서 앞 400자(보통 표지/목차)를 기준으로 prefix 생성. 문서 후반부 청크의 prefix가 실제 내용과 무관해진다.

**수정 내용**:

```typescript
private async generateContextualPrefix(
  docTitle: string,
  fullText: string,
  chunkText: string,
  chunkOffset: number,  // 파라미터 추가 — 전체 텍스트에서 이 청크의 시작 위치
): Promise<string> {
  // 청크 주변 로컬 맥락: 청크 시작 전 300자 + 청크 후 100자
  const contextStart = Math.max(0, chunkOffset - 300);
  const contextEnd = Math.min(
    fullText.length,
    chunkOffset + chunkText.length + 100,
  );
  const localContext = fullText.substring(contextStart, contextEnd);

  // 문서 대표 샘플: 첫 200자 + 중간 200자로 대표성 확보
  const mid = Math.floor(fullText.length / 2);
  const docSample = `${fullText.substring(0, 200)}\n...\n${fullText.substring(mid, mid + 200)}`;

  // ...나머지 LLM 호출
}
```

`buildVectorDocs()`에서 각 parent 청크의 텍스트 오프셋을 추적해서 `generateContextualPrefix()`에 전달해야 한다.

---

## 3. 검색 정확도 개선

### 3-1. MongoDB 텍스트 검색 — 한국어 형태소 미지원

**파일**: `apps/ai-service/src/qa/infrastructure/search/mongo-text-search.adapter.ts:31-36`

**문제**: MongoDB `$text` 인덱스는 공백/구두점 기반 토크나이징만 수행. 한국어 형태소 분석 없음.

실제 미매칭 사례:
- "충전" 검색 → "충전하다", "충전됩니다", "충전이" 미매칭
- "환불" 검색 → "환불하다", "환불정책", "환불이" 미매칭

**개선 방향 (단계별)**

**단계 1 — 쿼리 부분 매칭 추가 (단기)**

```typescript
async search(query: string, topK: number): Promise<SimilaritySearchResult[]> {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  const regexConditions = terms.map((t) => ({
    text: { $regex: t, $options: 'i' },
  }));

  const results = await this.collection
    .find({ $or: [{ $text: { $search: query } }, ...regexConditions] })
    .project<ChunkRecord & { score: number }>({ ... })
    .limit(topK)
    .toArray();
}
```

단, `$regex`는 인덱스를 타지 않으므로 성능에 주의. `topK`를 줄이거나 별도 인덱스 추가 필요.

**단계 2 — Atlas Search로 마이그레이션 (권장)**

MongoDB Atlas Search는 한국어 형태소 분석기(`lucene.korean`)를 지원한다. `$text` 인덱스를 Atlas Search 인덱스로 교체하면 어미 변형 자동 매칭이 가능하다.

```json
{
  "mappings": {
    "fields": {
      "text": { "type": "string", "analyzer": "lucene.korean" }
    }
  }
}
```

검색 쿼리도 `$search` aggregation으로 교체 필요.

**단계 3 — 형태소 분석 사이드카 (Atlas 미사용 시)**

`konlpy`(Python) 또는 `node-mecab-async`로 검색어를 형태소 분해 후 `$text` 검색에 전달.

---

### 3-2. HyDE — 한국어 단어 수 계산 오류

**파일**: `apps/ai-service/src/qa/application/hyde.service.ts`  
**현재**:
```typescript
const wordCount = trimmed.split(/\s+/).length;
return wordCount >= MIN_QUERY_WORDS && wordCount <= MAX_QUERY_WORDS;
// MIN_QUERY_WORDS = 3, MAX_QUERY_WORDS = 10
```

**문제**: 한국어는 조사가 단어에 붙어 공백 없이 사용된다.  
예: "배터리충전방법알려주세요" → `wordCount = 1` → HyDE 미적용.

**수정 내용** (글자 수 기반 보완):

```typescript
private getWordCount(text: string): number {
  const spaceWords = text.trim().split(/\s+/).length;
  if (spaceWords === 1) {
    // 공백 없는 한국어 — 평균 어절 3-4자 기준으로 추정
    return Math.ceil(text.replace(/\s/g, '').length / 3);
  }
  return spaceWords;
}
```

또는 단어 수 대신 **글자 수 기준**으로 전환:
- 8자 이상 50자 이하 → HyDE 적용

---

### 3-3. Sibling 확장 범위 제한

**파일**: `apps/ai-service/src/qa/application/hybrid-search.use-case.ts:113-138`

**문제**: 검색된 child의 모든 sibling을 무제한 추가. reranker가 선별한 5개 결과에서 sibling 추가 후 최대 25-30개로 팽창해 LLM 컨텍스트에 노이즈가 증가한다.

**수정 내용**:

현재 `findByParentChunkIds()`는 해당 parentChunkId의 모든 child를 반환한다. 반환 결과를 검색된 child의 `chunkIndex ± N` 범위로 필터링해 인접 sibling만 추가한다.

```typescript
private async expandWithSiblings(
  chunks: SimilaritySearchResult[],
): Promise<SimilaritySearchResult[]> {
  const siblingWindow = 1; // 앞뒤 각 1개로 제한

  const parentChunkIds = [
    ...new Set(
      chunks
        .filter((c) => c.metadata.parentChunkId)
        .map((c) => c.metadata.parentChunkId as string),
    ),
  ];

  if (parentChunkIds.length === 0) return chunks;

  const siblings = await this.vectorStore.findByParentChunkIds(parentChunkIds);

  // 검색된 chunkIndex 집합
  const hitIndices = new Map<string, Set<number>>();
  for (const c of chunks) {
    if (!c.metadata.parentChunkId) continue;
    const key = c.metadata.parentChunkId;
    if (!hitIndices.has(key)) hitIndices.set(key, new Set());
    hitIndices.get(key)!.add(c.metadata.chunkIndex);
  }

  const existingKeys = new Set(
    chunks.map((c) => `${c.metadata.documentId}:${c.metadata.chunkIndex}`),
  );

  const newSiblings = siblings.filter((s) => {
    const key = `${s.metadata.documentId}:${s.metadata.chunkIndex}`;
    if (existingKeys.has(key)) return false;
    const pid = s.metadata.parentChunkId;
    if (!pid || !hitIndices.has(pid)) return false;
    // 히트된 chunkIndex와 siblingWindow 이내인 경우만 포함
    return [...hitIndices.get(pid)!].some(
      (idx) => Math.abs(s.metadata.chunkIndex - idx) <= siblingWindow,
    );
  });

  return [...chunks, ...newSiblings];
}
```

---

## 4. 질의 처리 개선

### 4-1. Follow-up 판단 — 하드코딩 지시어 목록 개선

**파일**: `apps/ai-service/src/qa/application/conversational-query-rewriter.service.ts`

**문제**: `이것`, `그것`, ` it ` 등 하드코딩된 지시어 목록으로 follow-up을 판단한다. 지시어 없이 맥락에 의존하는 follow-up("더 자세히 알려줘", "다른 방법은?")을 탐지하지 못한다.

**개선 방향**

단기: 지시어 목록 확장.  
```typescript
private readonly FOLLOWUP_PATTERNS = [
  '이것', '그것', '저것', '이거', '그거',
  '위', '아래', '앞서', '방금',
  '더', '추가로', '그러면', '그럼',
  ' it ', ' this ', ' that ', ' these ', ' those ',
];
```

중기: LLM 기반 follow-up 분류. 짧은 질문(30자 이하)에만 적용해 비용 최소화.

```typescript
async isFollowUp(
  question: string,
  history: ConversationTurn[],
): Promise<boolean> {
  if (history.length === 0 || question.length > 80) return false;
  // 빠른 패턴 매칭으로 명백한 케이스 먼저 처리
  if (this.hasFollowUpPattern(question)) return true;

  // 패턴 미매칭 + 짧은 질문 → LLM 판단 (Haiku 등 소형 모델)
  const prompt = `대화 이력:\n${this.formatHistory(history)}\n\n새 질문: "${question}"\n\n이 질문이 이전 대화 없이 단독으로 이해 가능한가? yes 또는 no만 답하라.`;
  const result = await this.fastLlm.complete(prompt, { maxTokens: 5 });
  return result.trim().toLowerCase() === 'no';
}
```

---

## 5. LLM 응답 품질 개선

### 5-1. streamFiltered 정규식 누락 패턴

**파일**: `apps/ai-service/src/qa/application/ask.use-case.ts:204-211`  
**심각도**: 높음

**문제**  
`isFilteredLine()` 정규식이 볼드 처리된 Step 헤딩을 처리하지 못한다.

실제 출력 예시:
```
**Step 1**: 위메이드플레이 경력을 분석하겠습니다.
**Step 2**: 채팅 서비스 구현 내용을 정리합니다.
```

현재 `^\*{0,2}Step\s*\d+[:\)]` 패턴은 `**Step 1**:` (숫자 뒤에 `**`가 오는 형태)를 처리하지 못한다.

**수정 내용**:

```typescript
const isFilteredLine = (line: string): boolean =>
  /^#{1,3}\s*Step\s*\d+/i.test(line) ||
  /^\*{0,2}\s*Step\s*\d+\**[:\)]/i.test(line) ||   // **Step 1**: / **Step 1**) 추가
  /^The final answer is/i.test(line) ||
  /^In conclusion[,:\s]/i.test(line) ||
  /^To summarize[,:\s]/i.test(line) ||
  /\$\\boxed\{/.test(line) ||
  /\\boxed\{/.test(line) ||
  /^\*{0,2}\s*최종\s*답변\s*[:\*]/i.test(line) ||  // 한국어 "최종 답변:" 패턴 추가
  /^\*{0,2}\s*결론\s*[:\*]/i.test(line);            // 한국어 "결론:" 패턴 추가
```

---

### 5-2. llama-3.3-70b-versatile 모델 교체 검토

**파일**: `docker/docker-compose.yml`, `apps/ai-service/src/llm-gateway/`  
**심각도**: 중간

**문제**  
`llama-3.3-70b-versatile`(Groq)은 수학 추론 fine-tuning의 영향으로 일반 질문에도 다음 패턴을 강제 적용한다:

```
## Step 1: 질문 분석
...
## Step 2: 내용 검토
...
The final answer is: $\boxed{6}
```

`$\boxed{6}` 내 숫자 "6"은 경력 년수를 계산한 것으로, 모델이 이력서 질문을 산술 계산 문제로 처리하고 있음을 의미한다. 시스템 프롬프트의 "Step N 금지" 지시를 지속적으로 무시한다.

**모델 비교 (Groq 제공, 2026-07 기준)**

| 모델 | 특성 | RAG 적합성 | Step 포맷 |
|------|------|-----------|-----------|
| `llama-3.3-70b-versatile` | 현재 사용 중 | 보통 | 자주 발생 |
| `llama-3.1-8b-instant` | 소형, 빠름 | 보통 | 드뭄 |
| `gemma2-9b-it` | instruction-following 우수 | 좋음 | 거의 없음 |
| `mixtral-8x7b-32768` | 32K 컨텍스트 | 좋음 | 거의 없음 |
| `qwen-qwq-32b` | 추론 특화 | 나쁨 | 항상 발생 |

**권장**: `gemma2-9b-it` 또는 `mixtral-8x7b-32768`로 교체 후 답변 품질 비교.

```bash
# docker-compose.yml 또는 .env에서
LLM_PROVIDER=groq
# GROQ_MODEL 환경변수 추가 필요
GROQ_MODEL=gemma2-9b-it
```

---

### 5-3. 한국어 자모 분해 스트리밍 문제

**파일**: `apps/ai-service/src/qa/application/ask.use-case.ts:198-233` (`streamFiltered`)  
**심각도**: 중간 (사용자 경험 저하)

**문제**  
스트리밍 시 한글이 `ᄀ`, `ᅡ`, `ᆼ` 등 개별 자모로 분리되어 도착하는 현상.

원인: Groq 스트리밍 API가 UTF-8 바이트 경계를 무시하고 토큰을 분할하거나, 모델 토크나이저가 한글을 자모 단위로 분해하여 청크를 전송.

현재 `streamFiltered`의 `lineBuffer`가 불완전한 유니코드 시퀀스를 처리하지 못할 수 있다.

**수정 방향**:

```typescript
private async *streamFiltered(
  source: AsyncIterable<string>,
): AsyncIterable<string> {
  let lineBuffer = '';
  let charBuffer = '';  // 불완전한 UTF-8 조각을 누적
  let consecutiveBlanks = 0;

  for await (const token of source) {
    charBuffer += token;
    // 유효한 유니코드 문자열인지 확인 후에만 lineBuffer에 추가
    // 한글 자모가 완성형 문자로 조합될 때까지 대기
    const normalized = charBuffer.normalize('NFC');
    if (normalized !== charBuffer || this.hasIncompleteChar(charBuffer)) {
      continue; // 아직 조합 중
    }
    lineBuffer += normalized;
    charBuffer = '';
    // ... 기존 라인 처리 로직
  }
}

private hasIncompleteChar(str: string): boolean {
  // 자모 영역 (U+1100-U+11FF, U+A960-U+A97F, U+D7B0-U+D7FF) 체크
  return /[ᄀ-ᇿꥠ-꥿ힰ-퟿]/.test(str);
}
```

근본 해결: `LlmGatewayService`에서 Groq 스트리밍 응답을 받을 때 청크 단위 버퍼링을 적용.

---

## 6. 우선순위 요약

| 우선순위 | 항목 | 관련 파일 | 예상 효과 | 변경 규모 |
|---------|------|----------|-----------|----------|
| **P0** | 1-0. 회사/프로젝트 헤더 맥락 단절 (청킹 구조 결함) | `ingest-document.use-case.ts` | 답변 내용 불일치 근본 해결 (재인제스트 필요) | 중 |
| **P0** | 1-1. 텍스트 검색 parentChunkId 누락 (버그) | `mongo-text-search.adapter.ts` | 텍스트 검색 청크 sibling 확장 적용 | 소 |
| **P0** | 1-2. agentic-ask parentText 미사용 (버그) | `agentic-ask.use-case.ts` | Agentic 경로 답변 품질 개선 | 소 |
| **P0** | 5-1. streamFiltered 정규식 누락 패턴 수정 | `ask.use-case.ts` | `**Step N**:` 등 필터 누락 패턴 제거 | 소 |
| **P1** | 5-2. LLM 모델 교체 (`gemma2-9b-it`) | `docker-compose.yml`, `.env` | Step/boxed 포맷 출력 근절 | 소 |
| **P1** | 2-3. 한국어 종결어미 separator 보완 | `ingest-document.use-case.ts` | 청크 경계 개선 (재인제스트 필요) | 소 |
| **P1** | 3-2. HyDE 한국어 단어 수 계산 수정 | `hyde.service.ts` | 짧은 한국어 질문에 HyDE 적용 | 소 |
| **P1** | 4-1. Follow-up 판단 패턴 확장 | `conversational-query-rewriter.service.ts` | 맥락 없는 follow-up 탐지 개선 | 소 |
| **P2** | 5-3. 한국어 자모 분해 스트리밍 수정 | `ask.use-case.ts`, `llm-gateway` | 자모 분리 렌더링 문제 해결 | 중 |
| **P2** | 3-3. Sibling 확장 범위 제한 | `hybrid-search.use-case.ts` | LLM 컨텍스트 노이즈 감소 | 중 |
| **P2** | 2-5. Contextual prefix 샘플링 개선 | `ingest-document.use-case.ts` | 문서 후반부 청크 prefix 정확도 개선 | 중 |
| **P2** | 2-4. Child/Parent 청크 크기 조정 | `ingest-document.use-case.ts` | 임베딩 품질 개선 (재인제스트 필요) | 중 |
| **P3** | 2-2. 의미 경계 기반 청킹 | `ingest-document.use-case.ts` | 청크 품질 근본 개선 (재인제스트 필요) | 대 |
| **P3** | 2-1. PDF 추출기 교체 (`pdfjs-dist`) | `ingest-document.use-case.ts` | 레이아웃 복잡 PDF 정확도 대폭 개선 | 대 |
| **P3** | 3-1. MongoDB Atlas Search 한국어 형태소 | `mongo-text-search.adapter.ts` | 렉시컬 검색 정확도 대폭 개선 | 대 |

### 권장 적용 순서

```
즉시 (코드 수정 후 Docker 재빌드):
  - 5-1. streamFiltered 정규식 보완 → **Step N**: 패턴 필터링
  - 1-1. 텍스트 검색 parentChunkId 누락 수정
  - 1-2. agentic-ask parentText 미사용 수정

단기 (재인제스트 포함):
  - 1-0. 섹션 헤더 prefix 삽입 후 이력서 재업로드 → 답변 내용 불일치 해결
  - 2-3. 한국어 종결어미 separator 보완
  - 5-2. LLM 모델 교체 (gemma2-9b-it) → Step 포맷 근절

중기 (스테이징 A/B 테스트 후):
  - 5-3. 한국어 자모 분해 수정
  - 3-3. Sibling 확장 범위 제한
  - 2-4. 청크 크기 조정 + 재인제스트

별도 스프린트 (대형 변경):
  - 2-2. 의미 경계 기반 청킹
  - 2-1. PDF 추출기 교체
  - 3-1. MongoDB Atlas Search 마이그레이션
```

---

*이 문서는 현재 코드 및 MongoDB 데이터 분석 결과를 기반으로 작성됐다. P2 이상의 변경은 스테이징 환경에서 검색 정확도를 측정한 뒤 적용을 권장한다.*
