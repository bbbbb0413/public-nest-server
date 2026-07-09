// 응답 유출(exfiltration) 방지를 위한 시크릿/PII 탐지 패턴 (OWASP LLM02:2025)
// SecretPiiScanner(qa 응답)에서 사용한다.
export interface SecretPiiPattern {
  readonly label: string;
  readonly pattern: RegExp;
}

export const SECRET_PII_PATTERNS: readonly SecretPiiPattern[] = [
  // API 키 / 인증 토큰
  { label: 'OPENAI_API_KEY', pattern: /sk-[A-Za-z0-9]{20,}/g },
  { label: 'AWS_ACCESS_KEY', pattern: /AKIA[0-9A-Z]{16}/g },
  {
    label: 'JWT',
    pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  },
  { label: 'BEARER_TOKEN', pattern: /Bearer\s+[A-Za-z0-9._-]{10,}/gi },
  {
    label: 'PRIVATE_KEY',
    pattern:
      /-----BEGIN[ A-Z]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z]*PRIVATE KEY-----/g,
  },

  // 개인식별정보(PII)
  {
    label: 'EMAIL',
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  { label: 'KR_RRN', pattern: /\b\d{6}-?[1-4]\d{6}\b/g },
  { label: 'KR_PHONE', pattern: /01[016789]-?\d{3,4}-?\d{4}/g },
];
