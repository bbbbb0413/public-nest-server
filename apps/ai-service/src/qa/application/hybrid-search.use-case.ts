import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmbeddingProvider, EmbeddingProvider } from '@libs/llm';
import {
  IVectorStorePort,
  VectorStorePort,
  SimilaritySearchResult,
} from '../../knowledge/domain/port/vector-store.port';
import {
  ILexicalSearchPort,
  LexicalSearchPort,
} from '../domain/port/lexical-search.port';
import { IRerankerPort, RerankerPort } from '../domain/port/reranker.port';
import { RrfFusionService } from './rrf-fusion.service';
import { HydeService } from './hyde.service';
import { QueryDecomposer } from './query-decomposer.service';
import { HybridSearchCommand } from './hybrid-search.command';

const DEFAULT_CANDIDATE_K = 40;
const DEFAULT_RERANKER_TOP_N = 12;
const DEFAULT_RRF_K = 60;
const HYDE_SIMILARITY_THRESHOLD = 0.5;

export interface HybridSearchResult {
  queryEmbedding: number[];
  chunks: SimilaritySearchResult[];
}

@Injectable()
export class HybridSearchUseCase {
  private readonly candidateK: number;
  private readonly rerankerTopN: number;
  private readonly rerankerEnabled: boolean;
  private readonly rrfK: number;

  constructor(
    @Inject(EmbeddingProvider)
    private readonly embeddingProvider: IEmbeddingProvider,
    @Inject(VectorStorePort) private readonly vectorStore: IVectorStorePort,
    @Inject(LexicalSearchPort)
    private readonly lexicalSearch: ILexicalSearchPort,
    @Inject(RerankerPort) private readonly reranker: IRerankerPort,
    private readonly rrfFusion: RrfFusionService,
    private readonly hydeService: HydeService,
    private readonly queryDecomposer: QueryDecomposer,
    private readonly configService: ConfigService,
  ) {
    const rawK = this.configService.get<string>('HYBRID_CANDIDATE_K');
    this.candidateK =
      rawK !== undefined && !isNaN(Number(rawK))
        ? Number(rawK)
        : DEFAULT_CANDIDATE_K;

    const rawN = this.configService.get<string>('RERANKER_TOP_N');
    this.rerankerTopN =
      rawN !== undefined && !isNaN(Number(rawN))
        ? Number(rawN)
        : DEFAULT_RERANKER_TOP_N;

    const rawRrfK = this.configService.get<string>('RRF_K');
    this.rrfK =
      rawRrfK !== undefined && !isNaN(Number(rawRrfK))
        ? Number(rawRrfK)
        : DEFAULT_RRF_K;

    this.rerankerEnabled =
      this.configService.get<string>('RERANKER_ENABLED') !== 'false';
  }

  async execute(command: HybridSearchCommand): Promise<HybridSearchResult> {
    if (this.queryDecomposer.shouldDecompose(command.question)) {
      return this.executeDecomposed(command);
    }
    return this.executeSimple(command);
  }

  private async executeSimple(
    command: HybridSearchCommand,
  ): Promise<HybridSearchResult> {
    const queryEmbedding = await this.resolveQueryEmbedding(
      command.question,
      command.useHyde,
    );

    const [denseResults, lexicalResults] = await Promise.all([
      this.vectorStore.similaritySearch(queryEmbedding, this.candidateK),
      this.lexicalSearch.search(command.question, this.candidateK),
    ]);

    const merged = this.rrfFusion.fuse(
      [denseResults, lexicalResults],
      this.rrfK,
    );

    let ranked = merged;
    if (this.rerankerEnabled) {
      ranked = await this.reranker.rerank(
        command.question,
        merged,
        this.rerankerTopN,
      );
    }

    const topRanked = ranked.slice(0, command.topK);
    const enriched = await this.expandWithSiblings(topRanked);

    return {
      queryEmbedding,
      chunks: enriched,
    };
  }

  private async expandWithSiblings(
    chunks: SimilaritySearchResult[],
  ): Promise<SimilaritySearchResult[]> {
    const parentChunkIds = [
      ...new Set(
        chunks
          .filter((c) => c.metadata.parentChunkId)
          .map((c) => c.metadata.parentChunkId as string),
      ),
    ];

    if (parentChunkIds.length === 0) return chunks;

    const hitIndices = new Map<string, number>();
    for (const c of chunks) {
      if (c.metadata.parentChunkId) {
        hitIndices.set(c.metadata.parentChunkId, c.metadata.chunkIndex);
      }
    }

    const siblings =
      await this.vectorStore.findByParentChunkIds(parentChunkIds);

    const existingKeys = new Set(
      chunks.map((c) => `${c.metadata.documentId}:${c.metadata.chunkIndex}`),
    );
    const newSiblings = siblings.filter((s) => {
      if (
        existingKeys.has(`${s.metadata.documentId}:${s.metadata.chunkIndex}`)
      ) {
        return false;
      }
      const parentId = s.metadata.parentChunkId;
      if (!parentId) return false;
      const hitIdx = hitIndices.get(parentId);
      if (hitIdx === undefined) return false;
      return Math.abs(s.metadata.chunkIndex - hitIdx) <= 1;
    });

    return [...chunks, ...newSiblings];
  }

  private async executeDecomposed(
    command: HybridSearchCommand,
  ): Promise<HybridSearchResult> {
    const subQueries = await this.queryDecomposer.decompose(command.question);

    const subResults = await Promise.all(
      subQueries.map((sq) =>
        this.executeSimple(
          new HybridSearchCommand(sq, command.topK, command.useHyde),
        ),
      ),
    );

    const merged = this.rrfFusion.fuse(
      subResults.map((r) => r.chunks),
      this.rrfK,
    );

    return {
      queryEmbedding: subResults[0].queryEmbedding,
      chunks: merged.slice(0, command.topK),
    };
  }

  private async resolveQueryEmbedding(
    question: string,
    useHyde: boolean,
  ): Promise<number[]> {
    const [originalEmbedding] = await this.embeddingProvider.embed([question]);

    if (!useHyde || !this.hydeService.shouldApply(question)) {
      return originalEmbedding;
    }

    const hypothetical = await this.hydeService.generateHypothetical(question);
    const [hydeEmbedding] = await this.embeddingProvider.embed([hypothetical]);

    const similarity = this.cosineSimilarity(originalEmbedding, hydeEmbedding);
    if (similarity >= HYDE_SIMILARITY_THRESHOLD) {
      return originalEmbedding.map((v, i) => (v + hydeEmbedding[i]) / 2);
    }
    return originalEmbedding;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}
