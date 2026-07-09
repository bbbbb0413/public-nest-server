import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IRerankerPort } from '../../domain/port/reranker.port';
import { SimilaritySearchResult } from '../../../knowledge/domain/port/vector-store.port';

interface RerankerResponseItem {
  index: number;
  relevance_score: number;
}

interface RerankerResponse {
  results: RerankerResponseItem[];
}

@Injectable()
export class HttpRerankerAdapter implements IRerankerPort {
  private readonly logger = new Logger(HttpRerankerAdapter.name);
  private readonly apiUrl: string;
  private readonly apiKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('RERANKER_API_URL') ?? '';
    this.apiKey = this.configService.get<string>('RERANKER_API_KEY');
  }

  async rerank(
    query: string,
    chunks: SimilaritySearchResult[],
    topN: number,
  ): Promise<SimilaritySearchResult[]> {
    if (!this.apiUrl) {
      this.logger.warn('RERANKER_API_URL이 설정되지 않아 리랭킹을 건너뜁니다.');
      return chunks.slice(0, topN);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          documents: chunks.map((c) => c.metadata.parentText ?? c.text),
          top_n: topN,
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `Reranker API 오류 (${response.status}), 원본 순서로 반환합니다.`,
        );
        return chunks.slice(0, topN);
      }

      const data = (await response.json()) as RerankerResponse;
      return data.results
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .map((item) => ({
          ...chunks[item.index],
          score: item.relevance_score,
        }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      this.logger.warn(
        `Reranker API 호출 실패: ${msg}, 원본 순서로 반환합니다.`,
      );
      return chunks.slice(0, topN);
    }
  }
}
