import { RankedChunk } from '../src/qa/domain/vo/ranked-chunk.vo';

const baseProps = {
  text: '관련 문서 내용',
  score: 0.95,
  rank: 1,
  metadata: { documentId: 'doc-1', fileName: 'a.txt', chunkIndex: 0 },
};

describe('RankedChunk', () => {
  it('유효한 값으로 생성된다', () => {
    const chunk = RankedChunk.of(baseProps);

    expect(chunk.text).toBe('관련 문서 내용');
    expect(chunk.score).toBe(0.95);
    expect(chunk.rank).toBe(1);
    expect(chunk.metadata.documentId).toBe('doc-1');
  });

  it('score가 0 미만이면 오류를 던진다', () => {
    expect(() =>
      RankedChunk.of({ ...baseProps, score: -0.1 }),
    ).toThrow('score는 0 이상이어야 합니다.');
  });

  it('rank가 1 미만이면 오류를 던진다', () => {
    expect(() =>
      RankedChunk.of({ ...baseProps, rank: 0 }),
    ).toThrow('rank는 1 이상이어야 합니다.');
  });

  it('text가 비어있으면 오류를 던진다', () => {
    expect(() =>
      RankedChunk.of({ ...baseProps, text: '' }),
    ).toThrow('text는 비어있을 수 없습니다.');
  });

  it('동일한 값을 가진 두 청크는 equals가 true이다', () => {
    const a = RankedChunk.of(baseProps);
    const b = RankedChunk.of(baseProps);
    expect(a.equals(b)).toBe(true);
  });

  it('다른 rank를 가진 두 청크는 equals가 false이다', () => {
    const a = RankedChunk.of(baseProps);
    const b = RankedChunk.of({ ...baseProps, rank: 2 });
    expect(a.equals(b)).toBe(false);
  });

  it('toSimilarityResult()로 SimilaritySearchResult로 변환된다', () => {
    const chunk = RankedChunk.of({
      text: '내용',
      score: 0.85,
      rank: 2,
      metadata: { documentId: 'doc-2', fileName: 'b.txt', chunkIndex: 1 },
    });
    const result = chunk.toSimilarityResult();

    expect(result.text).toBe('내용');
    expect(result.score).toBe(0.85);
    expect(result.metadata.documentId).toBe('doc-2');
    expect(result.metadata.chunkIndex).toBe(1);
  });
});
