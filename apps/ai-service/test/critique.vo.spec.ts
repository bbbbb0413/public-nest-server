import { Critique } from '../src/qa/domain/vo/critique.vo';

describe('Critique VO', () => {
  describe('생성 유효성 검증', () => {
    it('confidence가 -0.1이면 예외를 던진다', () => {
      expect(() => Critique.of(true, [], '다음 질의', -0.1)).toThrow(
        'confidence는 0 이상 1 이하여야 합니다.',
      );
    });

    it('confidence가 1.1이면 예외를 던진다', () => {
      expect(() => Critique.of(true, [], '다음 질의', 1.1)).toThrow(
        'confidence는 0 이상 1 이하여야 합니다.',
      );
    });

    it('confidence 경계값 0은 유효하다', () => {
      expect(() =>
        Critique.of(false, ['누락 정보'], '다음 질의', 0),
      ).not.toThrow();
    });

    it('confidence 경계값 1은 유효하다', () => {
      expect(() => Critique.of(true, [], '', 1)).not.toThrow();
    });
  });

  describe('isSatisfied', () => {
    it('answered=true이고 confidence>=threshold면 만족', () => {
      const critique = Critique.of(true, [], '', 0.8);

      expect(critique.isSatisfied(0.8)).toBe(true);
    });

    it('answered=true이고 confidence>threshold면 만족', () => {
      const critique = Critique.of(true, [], '', 0.9);

      expect(critique.isSatisfied(0.8)).toBe(true);
    });

    it('answered=false이면 confidence가 높아도 불만족', () => {
      const critique = Critique.of(false, ['누락 정보'], '다음 질의', 0.9);

      expect(critique.isSatisfied(0.8)).toBe(false);
    });

    it('answered=true이지만 confidence<threshold면 불만족', () => {
      const critique = Critique.of(true, ['부분 누락'], '보완 질의', 0.7);

      expect(critique.isSatisfied(0.8)).toBe(false);
    });
  });

  describe('접근자', () => {
    it('getNextQuery는 nextQuery를 반환한다', () => {
      const critique = Critique.of(
        false,
        ['정보 A'],
        '정보 A에 대해 더 검색',
        0.5,
      );

      expect(critique.getNextQuery()).toBe('정보 A에 대해 더 검색');
    });

    it('getConfidence는 confidence를 반환한다', () => {
      const critique = Critique.of(true, [], '', 0.85);

      expect(critique.getConfidence()).toBe(0.85);
    });

    it('getMissing은 누락 항목 배열의 복사본을 반환한다', () => {
      const missing = ['항목 A', '항목 B'];
      const critique = Critique.of(false, missing, '다음 질의', 0.4);
      const result = critique.getMissing();

      expect(result).toEqual(['항목 A', '항목 B']);
      result.push('임의 추가');
      expect(critique.getMissing()).toHaveLength(2);
    });
  });
});
