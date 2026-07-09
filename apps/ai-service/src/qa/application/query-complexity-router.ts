import { Injectable } from '@nestjs/common';

// 다중 주제 비교/분석이 명확히 필요한 경우에만 agentic 경로 사용
// "및", "또는" 같은 일반 접속사는 complex 트리거에서 제외
const KO_COMPLEX_KEYWORDS = [
  '비교해',
  '비교하',
  '차이',
  '차이점',
  '어떻게 다른',
  '왜',
  '원인',
];
const EN_COMPLEX_PATTERN =
  /\b(compare|difference between|why|explain how|analyze|versus|vs\.)\b/i;
const COMPLEX_WORD_THRESHOLD = 10;

@Injectable()
export class QueryComplexityRouter {
  route(question: string): 'simple' | 'complex' {
    const words = question.trim().split(/\s+/).filter(Boolean);
    const hasKoKeyword = KO_COMPLEX_KEYWORDS.some((kw) =>
      question.includes(kw),
    );
    if (
      hasKoKeyword ||
      EN_COMPLEX_PATTERN.test(question) ||
      words.length >= COMPLEX_WORD_THRESHOLD
    ) {
      return 'complex';
    }
    return 'simple';
  }
}
