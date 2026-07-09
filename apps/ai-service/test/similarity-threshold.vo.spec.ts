import { SimilarityThreshold } from '../src/qa/domain/vo/similarity-threshold.vo';

describe('SimilarityThreshold VO', () => {
  it('0과 1 사이의 값으로 생성한다', () => {
    const threshold = SimilarityThreshold.of(0.85);
    expect(threshold.getValue()).toBe(0.85);
  });

  it('0은 유효한 값으로 허용한다', () => {
    const threshold = SimilarityThreshold.of(0);
    expect(threshold.getValue()).toBe(0);
  });

  it('1은 유효한 값으로 허용한다', () => {
    const threshold = SimilarityThreshold.of(1);
    expect(threshold.getValue()).toBe(1);
  });

  it('0보다 작은 값은 예외를 던진다', () => {
    expect(() => SimilarityThreshold.of(-0.1)).toThrow(
      '유사도 임계값은 0과 1 사이여야 합니다.',
    );
  });

  it('1보다 큰 값은 예외를 던진다', () => {
    expect(() => SimilarityThreshold.of(1.1)).toThrow(
      '유사도 임계값은 0과 1 사이여야 합니다.',
    );
  });
});
