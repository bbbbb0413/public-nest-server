import { RrfFusionService } from '../src/qa/application/rrf-fusion.service';
import { SimilaritySearchResult } from '../src/knowledge/domain/port/vector-store.port';

const makeChunk = (
  documentId: string,
  chunkIndex = 0,
  text = 'content',
): SimilaritySearchResult => ({
  text,
  score: 0.9,
  metadata: { documentId, fileName: 'f.txt', chunkIndex },
});

describe('RrfFusionService', () => {
  let service: RrfFusionService;

  beforeEach(() => {
    service = new RrfFusionService();
  });

  it('빈 결과 목록들을 합치면 빈 배열을 반환한다', () => {
    expect(service.fuse([[], []])).toEqual([]);
  });

  it('단일 결과 목록은 RRF 점수로 변환해 반환한다', () => {
    const list = [makeChunk('doc-1'), makeChunk('doc-2')];
    const result = service.fuse([list]);
    expect(result).toHaveLength(2);
  });

  it('두 목록에 모두 등장한 문서가 한 목록에만 있는 문서보다 높은 점수를 갖는다', () => {
    const dense = [makeChunk('doc-X'), makeChunk('doc-Y')];
    const lexical = [makeChunk('doc-X')];

    const result = service.fuse([dense, lexical]);
    const docX = result.find((r) => r.metadata.documentId === 'doc-X');
    const docY = result.find((r) => r.metadata.documentId === 'doc-Y');
    expect(docX!.score).toBeGreaterThan(docY!.score);
  });

  it('중복 문서는 제거되고 score 내림차순으로 정렬된다', () => {
    const dense = [makeChunk('doc-1'), makeChunk('doc-2')];
    const lexical = [makeChunk('doc-1'), makeChunk('doc-3')];

    const result = service.fuse([dense, lexical]);
    expect(result).toHaveLength(3);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
    }
  });

  it('서로 다른 chunkIndex는 다른 문서로 취급한다', () => {
    const dense = [makeChunk('doc-1', 0), makeChunk('doc-1', 1)];
    const result = service.fuse([dense]);
    expect(result).toHaveLength(2);
  });

  it('k 파라미터가 작을수록 첫 번째 순위 문서의 점수가 높아진다', () => {
    const list = [makeChunk('doc-1')];
    const scoreK60 = service.fuse([list], 60)[0].score;
    const scoreK1 = service.fuse([list], 1)[0].score;
    expect(scoreK1).toBeGreaterThan(scoreK60);
  });

  it('빈 결과 목록이 없어도 동작한다', () => {
    const result = service.fuse([]);
    expect(result).toEqual([]);
  });
});
