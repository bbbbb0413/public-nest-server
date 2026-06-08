import { Injectable } from '@nestjs/common';
import { Collection, MongoClient } from 'mongodb';
import {
  IVectorStorePort,
  VectorDocument,
  SimilaritySearchResult,
} from '../../domain/port/vector-store.port';

interface VectorRecord {
  id: string;
  text: string;
  embedding: number[];
  documentId: string;
  fileName: string;
  chunkIndex: number;
}

@Injectable()
export class MongoDBVectorAdapter implements IVectorStorePort {
  private readonly collection: Collection<VectorRecord>;

  constructor(client: MongoClient, dbName: string) {
    this.collection = client
      .db(dbName)
      .collection<VectorRecord>('knowledge_chunks');
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
      },
    }));
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.collection.deleteMany({ documentId });
  }
}
