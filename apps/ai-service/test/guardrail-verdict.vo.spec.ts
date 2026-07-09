import { GuardrailVerdict } from '../src/qa/domain/vo/guardrail-verdict.vo';

describe('GuardrailVerdict VO', () => {
  it('allow()는 허용 판정을 생성한다', () => {
    const verdict = GuardrailVerdict.allow();

    expect(verdict.isAllowed()).toBe(true);
    expect(verdict.getReason()).toBe('ok');
  });

  it('block()은 사유와 매칭 패턴을 포함한 차단 판정을 생성한다', () => {
    const verdict = GuardrailVerdict.block(
      '의심스러운 지시문 패턴',
      'ignore previous instructions',
    );

    expect(verdict.isAllowed()).toBe(false);
    expect(verdict.getReason()).toBe('의심스러운 지시문 패턴');
  });

  it('block()은 매칭 패턴 없이도 차단 판정을 생성할 수 있다', () => {
    const verdict = GuardrailVerdict.block('의심스러운 지시문 패턴');

    expect(verdict.isAllowed()).toBe(false);
    expect(verdict.getReason()).toBe('의심스러운 지시문 패턴');
  });

  it('block()에 빈 사유를 전달하면 예외를 던진다', () => {
    expect(() => GuardrailVerdict.block('')).toThrow(
      '차단 판정에는 사유가 필요합니다.',
    );
  });
});
