// 프롬프트 인젝션 탐지 패턴 (OWASP LLM01:2025)
// PromptInjectionGuard(입력), RagContentValidator(검색 청크/인제스트 원문)에서 공통으로 사용한다.
export const INJECTION_PATTERNS: readonly RegExp[] = [
  // 이전 지시 무시 유도 (영문)
  /ignore\s+(all\s+)?(the\s+)?(previous|above|prior)\s+instructions?/i,
  /disregard\s+(all\s+)?(the\s+)?(previous|above|prior)\s+instructions?/i,
  /forget\s+(all\s+)?(the\s+)?(previous|above|prior)\s+instructions?/i,

  // 이전 지시 무시 유도 (한글)
  /이전\s*(지시|명령|규칙)(사항)?\s*(을|를)?\s*(모두\s*)?무시/,
  /위\s*(지시|명령|내용)(사항)?\s*(을|를)?\s*(모두\s*)?무시/,
  /지금까지의?\s*(지시|명령|규칙)(을|를)?\s*(모두\s*)?무시/,

  // 시스템 프롬프트/지시문 노출 시도 (영문 + 한글)
  /(reveal|print|show|output)\s+(me\s+)?(your\s+)?(system\s+)?prompt/i,
  /what\s+(is|are)\s+your\s+(system\s+)?instructions?/i,
  /(시스템\s*프롬프트|system\s*prompt)(을|를)?\s*(출력|보여|알려|공개)/i,
  /(너의|당신의|네)\s*(지시|명령|규칙|프롬프트)(을|를)?\s*(알려|보여|출력|공개)/,

  // 역할 재정의 및 탈옥(jailbreak) 시도 (영문)
  /you\s+are\s+now\s+/i,
  /act\s+as\s+(a|an)\s+\w+/i,
  /developer\s+mode/i,
  /do\s+anything\s+now/i,

  // 역할 재정의 및 탈옥(jailbreak) 시도 (한글)
  /너는\s*이제(부터)?\s*.*(이다|입니다|역할)/,
  /개발자\s*모드/,

  // 시스템/지시 영역 위장 마커
  /^\s*(system|assistant)\s*:/im,
  /###\s*(new|updated)\s+instructions?/i,
];
