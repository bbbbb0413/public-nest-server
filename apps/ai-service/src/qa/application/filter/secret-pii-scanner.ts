import { Injectable } from '@nestjs/common';
import { SECRET_PII_PATTERNS } from '../../domain/policy/secret-pii-patterns';

@Injectable()
export class SecretPiiScanner {
  // 텍스트 내 시크릿/PII 패턴을 [REDACTED_*] 토큰으로 마스킹 (불변 — 새 문자열 반환)
  mask(text: string): string {
    return SECRET_PII_PATTERNS.reduce(
      (masked, { label, pattern }) =>
        masked.replace(pattern, `[REDACTED_${label}]`),
      text,
    );
  }

  // 텍스트에 시크릿/PII 패턴이 하나라도 포함되어 있는지 검사
  containsSensitiveData(text: string): boolean {
    return SECRET_PII_PATTERNS.some(({ pattern }) =>
      new RegExp(pattern.source, pattern.flags).test(text),
    );
  }
}
