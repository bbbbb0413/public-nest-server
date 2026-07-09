import { QueryComplexityRouter } from '../src/qa/application/query-complexity-router';

describe('QueryComplexityRouter', () => {
  let router: QueryComplexityRouter;

  beforeEach(() => {
    router = new QueryComplexityRouter();
  });

  describe('simple 판정', () => {
    it('단어 5개 이하인 짧은 질의는 simple', () => {
      expect(router.route('RAG란 무엇인가')).toBe('simple');
    });

    it('단어 1개인 질의는 simple', () => {
      expect(router.route('RAG')).toBe('simple');
    });

    it('단어 5개 정확히인 질의는 simple', () => {
      expect(router.route('벡터 검색이란 무엇인가')).toBe('simple');
    });
  });

  describe('complex 판정', () => {
    it('비교 키워드를 포함한 질의는 complex', () => {
      expect(router.route('랭체인과 랭그래프의 차이점을 설명해줘')).toBe(
        'complex',
      );
    });

    it('"차이" 키워드를 포함한 질의는 complex', () => {
      expect(router.route('BM25와 벡터 검색의 차이는 무엇인가')).toBe(
        'complex',
      );
    });

    it('"비교" 키워드를 포함한 질의는 complex', () => {
      expect(router.route('두 방법을 비교해서 설명해줘')).toBe('complex');
    });

    it('단어 10개 초과인 긴 질의는 complex', () => {
      expect(
        router.route(
          'RAG 시스템에서 하이브리드 검색을 구현할 때 고려해야 할 사항은 무엇인가',
        ),
      ).toBe('complex');
    });

    it('"and" 접속사를 포함한 영어 질의는 complex', () => {
      expect(
        router.route('explain the difference between RAG and fine-tuning'),
      ).toBe('complex');
    });
  });
});
