import { Injectable } from '@nestjs/common';
import { GuardrailVerdict } from '../../domain/vo/guardrail-verdict.vo';
import { INJECTION_PATTERNS } from '../../domain/policy/injection-patterns';
import { SimilaritySearchResult } from '../../../knowledge/domain/port/vector-store.port';

@Injectable()
export class RagContentValidator {
  // 사용자 입력 1차 검사 — 의심 패턴 발견 시 차단 판정
  inspectInput(text: string): GuardrailVerdict {
    const cleaned = this.cleanText(text);
    const matched = INJECTION_PATTERNS.find((pattern) => pattern.test(cleaned));
    return matched
      ? GuardrailVerdict.block('의심스러운 지시문 패턴', matched.source)
      : GuardrailVerdict.allow();
  }

  // 검색된 청크에서 지시문 패턴이 포함된 라인을 제거 (불변 — 새 배열 반환)
  sanitize(
    chunks: readonly SimilaritySearchResult[],
  ): SimilaritySearchResult[] {
    return chunks.map((chunk) => ({
      ...chunk,
      text: this.cleanText(chunk.text)
        .split(/\r?\n/)
        .filter(
          (line) => !INJECTION_PATTERNS.some((pattern) => pattern.test(line)),
        )
        .join('\n'),
    }));
  }

  // 인제스트 시 문서 원문 1회 검사
  scan(rawText: string): GuardrailVerdict {
    return this.inspectInput(rawText);
  }

  // Unicode NFKC 정규화 + zero-width 문자 제거 (유니코드 우회 방지)
  private cleanText(text: string): string {
    return text.normalize('NFKC').replace(/[​-‍﻿]/g, '');
  }
}
