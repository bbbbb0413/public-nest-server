import { Injectable, Logger } from '@nestjs/common';
import { Collection, MongoClient } from 'mongodb';
import {
  IVectorStorePort,
  VectorDocument,
  SimilaritySearchResult,
} from '../../domain/port/vector-store.port';

const VECTOR_INDEX_NAME = 'knowledge_vector_index';

interface VectorRecord {
  id: string;
  text: string;
  embedding: number[];
  documentId: string;
  fileName: string;
  chunkIndex: number;
  charCount?: number;
  parentText?: string;
  parentChunkId?: string;
}

@Injectable()
export class MongoDBVectorAdapter implements IVectorStorePort {
  private readonly collection: Collection<VectorRecord>;
  private readonly logger = new Logger(MongoDBVectorAdapter.name);

  constructor(client: MongoClient, dbName: string) {
    this.collection = client
      .db(dbName)
      .collection<VectorRecord>('knowledge_chunks');
  }

  async ensureVectorIndex(): Promise<void> {
    try {
      const dimResult = await this.collection
        .aggregate<{ dim: number }>([
          { $limit: 1 },
          { $project: { dim: { $size: '$embedding' } } },
        ])
        .next();

      if (!dimResult) {
        this.logger.log('컬렉션이 비어 있어 벡터 인덱스 생성을 건너뜁니다');
        return;
      }

      const numDimensions = dimResult.dim;
      const indexes = await this.collection
        .aggregate<{ name: string; latestDefinition?: { fields?: Array<{ numDimensions?: number }> } }>([
          { $listSearchIndexes: {} },
        ])
        .toArray();

      const existing = indexes.find((idx) => idx.name === VECTOR_INDEX_NAME);

      if (existing) {
        const existingDim = existing.latestDefinition?.fields?.[0]?.numDimensions;
        if (existingDim === numDimensions) {
          this.logger.log(`벡터 인덱스 확인 완료 (${numDimensions}차원)`);
          return;
        }
        this.logger.warn(
          `차원 불일치: 인덱스=${existingDim}, 데이터=${numDimensions} — 인덱스를 재생성합니다`,
        );
        await this.collection.dropSearchIndex(VECTOR_INDEX_NAME);
        await new Promise<void>((r) => setTimeout(r, 2000));
      }

      await (this.collection.createSearchIndex as (def: object) => Promise<string>)({
        name: VECTOR_INDEX_NAME,
        type: 'vectorSearch',
        definition: {
          fields: [
            { type: 'vector', path: 'embedding', numDimensions, similarity: 'cosine' },
          ],
        },
      });

      this.logger.log(`벡터 인덱스 생성 완료 (${numDimensions}차원)`);
    } catch (e: unknown) {
      this.logger.warn(
        `벡터 인덱스 보장 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    if (documents.length === 0) return;
    const operations = documents.map((doc) => ({
      updateOne: {
        filter: { id: doc.id },
        update: {
          $set: {
            id: doc.id,
            text: doc.text,
            embedding: doc.embedding,
            documentId: doc.metadata.documentId,
            fileName: doc.metadata.fileName,
            chunkIndex: doc.metadata.chunkIndex,
            ...(doc.metadata.charCount !== undefined && {
              charCount: doc.metadata.charCount,
            }),
            ...(doc.metadata.parentText !== undefined && {
              parentText: doc.metadata.parentText,
            }),
            ...(doc.metadata.parentChunkId !== undefined && {
              parentChunkId: doc.metadata.parentChunkId,
            }),
          },
        },
        upsert: true,
      },
    }));
    await this.collection.bulkWrite(operations);
  }

  async similaritySearch(
    queryEmbedding: number[],
    topK: number,
  ): Promise<SimilaritySearchResult[]> {
    const results = await this.collection
      .aggregate([
        {
          $vectorSearch: {
            index: 'knowledge_vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: topK * 10,
            limit: topK,
          },
        },
        {
          $project: {
            text: 1,
            documentId: 1,
            fileName: 1,
            chunkIndex: 1,
            charCount: 1,
            parentText: 1,
            parentChunkId: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ])
      .toArray();

    return results.map((r) => ({
      text: r.text as string,
      score: r.score as number,
      metadata: {
        documentId: r.documentId as string,
        fileName: r.fileName as string,
        chunkIndex: r.chunkIndex as number,
        ...(r.charCount !== undefined && { charCount: r.charCount }),
        ...(r.parentText !== undefined && { parentText: r.parentText }),
        ...(r.parentChunkId !== undefined && {
          parentChunkId: r.parentChunkId,
        }),
      },
    }));
  }

  async findByParentChunkIds(
    parentChunkIds: string[],
  ): Promise<SimilaritySearchResult[]> {
    if (parentChunkIds.length === 0) return [];
    const results = await this.collection
      .find(
        { parentChunkId: { $in: parentChunkIds } },
        {
          projection: {
            text: 1,
            documentId: 1,
            fileName: 1,
            chunkIndex: 1,
            charCount: 1,
            parentText: 1,
            parentChunkId: 1,
          },
        },
      )
      .sort({ chunkIndex: 1 })
      .toArray();

    return results.map((r) => ({
      text: r.text as string,
      score: 0.5,
      metadata: {
        documentId: r.documentId as string,
        fileName: r.fileName as string,
        chunkIndex: r.chunkIndex as number,
        ...(r.charCount !== undefined && { charCount: r.charCount }),
        ...(r.parentText !== undefined && { parentText: r.parentText }),
        ...(r.parentChunkId !== undefined && {
          parentChunkId: r.parentChunkId,
        }),
      },
    }));
  }

  async findChunksByDocumentId(
    documentId: string,
  ): Promise<SimilaritySearchResult[]> {
    const results = await this.collection
      .find(
        { documentId },
        { projection: { text: 1, documentId: 1, fileName: 1, chunkIndex: 1 } },
      )
      .sort({ chunkIndex: 1 })
      .toArray();

    return results.map((r) => ({
      text: r.text as string,
      score: 1,
      metadata: {
        documentId: r.documentId as string,
        fileName: r.fileName as string,
        chunkIndex: r.chunkIndex as number,
      },
    }));
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.collection.deleteMany({ documentId });
  }
}
