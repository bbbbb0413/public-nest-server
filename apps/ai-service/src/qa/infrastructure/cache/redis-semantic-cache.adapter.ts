import { randomUUID } from 'crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AbstractRedisRepository } from '@libs/common/databases/redis/abstract-redis.repository';
import {
  ISemanticCachePort,
  SemanticCacheHit,
} from '../../domain/port/semantic-cache.port';

const SEMANTIC_CACHE_DB = 0;
const INDEX_NAME = 'sem_cache_idx';
const KEY_PREFIX = 'sem:cache:';
const DEFAULT_EMBEDDING_DIM = 1536;
const INDEX_ALREADY_EXISTS_MESSAGE = 'Index already exists';
const TAG_ESCAPE_PATTERN = /[,.<>{}[\]"':;!@#$%^&*()\-+=~| ]/g;

@Injectable()
export class RedisSemanticCacheAdapter
  extends AbstractRedisRepository
  implements ISemanticCachePort, OnModuleInit
{
  protected readonly dbNumber = SEMANTIC_CACHE_DB;

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    this.createRedisClient();
    await this.ensureIndex();
  }

  private parseNumberEnv(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    if (raw === undefined) {
      return fallback;
    }
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  private escapeTagValue(value: string): string {
    return value.replace(TAG_ESCAPE_PATTERN, '\\$&');
  }

  private async ensureIndex(): Promise<void> {
    const dim = this.parseNumberEnv(
      'EMBEDDING_DIMENSION',
      DEFAULT_EMBEDDING_DIM,
    );

    try {
      await this.redis.call(
        'FT.CREATE',
        INDEX_NAME,
        'ON',
        'HASH',
        'PREFIX',
        '1',
        KEY_PREFIX,
        'SCHEMA',
        'embedding',
        'VECTOR',
        'HNSW',
        '6',
        'TYPE',
        'FLOAT32',
        'DIM',
        String(dim),
        'DISTANCE_METRIC',
        'COSINE',
        'tenant',
        'TAG',
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '';
      if (!message.includes(INDEX_ALREADY_EXISTS_MESSAGE)) {
        throw e;
      }
    }
  }

  async findSimilar(
    embedding: number[],
    threshold: number,
    tenant: string,
  ): Promise<SemanticCacheHit | null> {
    const blob = Buffer.from(new Float32Array(embedding).buffer);
    const reply = (await this.redis.call(
      'FT.SEARCH',
      INDEX_NAME,
      `(@tenant:{${this.escapeTagValue(tenant)}})=>[KNN 1 @embedding $vec AS dist]`,
      'PARAMS',
      '2',
      'vec',
      blob,
      'SORTBY',
      'dist',
      'RETURN',
      '2',
      'answer',
      'dist',
      'DIALECT',
      '2',
    )) as unknown[];

    const parsed = this.parseKnnReply(reply);
    if (!parsed) {
      return null;
    }

    const score = 1 - parsed.dist;
    return score >= threshold ? { answer: parsed.answer, score } : null;
  }

  async store(
    embedding: number[],
    question: string,
    answer: string,
    ttlSeconds: number,
    tenant: string,
  ): Promise<void> {
    const key = `${KEY_PREFIX}${randomUUID()}`;
    const blob = Buffer.from(new Float32Array(embedding).buffer);
    await this.redis.hset(key, {
      embedding: blob,
      answer,
      question,
      tenant,
      createdAt: Date.now(),
    });
    await this.redis.expire(key, ttlSeconds);
  }

  private parseKnnReply(
    reply: unknown[],
  ): { answer: string; dist: number } | null {
    const total = reply[0] as number;
    if (!total) {
      return null;
    }

    const fields = reply[2] as unknown[];
    const result: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      result[fields[i] as string] = fields[i + 1] as string;
    }

    if (result.answer === undefined || result.dist === undefined) {
      return null;
    }

    return { answer: result.answer, dist: parseFloat(result.dist) };
  }
}
