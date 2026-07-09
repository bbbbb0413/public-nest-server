import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Collection, MongoClient } from 'mongodb';
import { ILexicalSearchPort } from '../../domain/port/lexical-search.port';
import { SimilaritySearchResult } from '../../../knowledge/domain/port/vector-store.port';

interface ChunkRecord {
  text: string;
  documentId: string;
  fileName: string;
  chunkIndex: number;
}

@Injectable()
export class MongoTextSearchAdapter
  implements ILexicalSearchPort, OnModuleInit
{
  private readonly collection: Collection<ChunkRecord>;

  constructor(
    @Inject('MONGO_CLIENT') client: MongoClient,
    private readonly configService: ConfigService,
  ) {
    const dbName =
      this.configService.get<string>('MONGODB_DB_NAME') ?? 'ai_service';
    this.collection = client
      .db(dbName)
      .collection<ChunkRecord>('knowledge_chunks');
  }

  async onModuleInit(): Promise<void> {
    await this.collection.createIndex(
      { text: 'text' },
      { name: 'text_search_idx' },
    );
  }

  async search(query: string, topK: number): Promise<SimilaritySearchResult[]> {
    const results = await this.collection
      .find({ $text: { $search: query } })
      .project<ChunkRecord & { score: number }>({
        text: 1,
        documentId: 1,
        fileName: 1,
        chunkIndex: 1,
        score: { $meta: 'textScore' },
      })
      .sort({ score: { $meta: 'textScore' } })
      .limit(topK)
      .toArray();

    return results.map((r) => ({
      text: r.text,
      score: (r as ChunkRecord & { score?: number }).score ?? 0,
      metadata: {
        documentId: r.documentId,
        fileName: r.fileName,
        chunkIndex: r.chunkIndex,
      },
    }));
  }
}
