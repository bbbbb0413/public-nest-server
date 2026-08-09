import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { RedisFactory } from '@libs/common/databases/redis/redis.factory';

export interface StreamEvent {
  id: string;
  type: string;
  data: unknown;
}

const BLOCK_MS = 10_000;

@Injectable()
export class RedisStreamsRelayService implements OnModuleDestroy {
  private readonly redis: Redis = RedisFactory.createRedisClient();

  onModuleDestroy(): void {
    this.redis.disconnect();
  }

  streamKey(jobId: string): string {
    return `ai:job:${jobId}:events`;
  }

  async readNext(jobId: string, afterId: string): Promise<StreamEvent[]> {
    const result = await this.redis.xread(
      'BLOCK',
      BLOCK_MS,
      'STREAMS',
      this.streamKey(jobId),
      afterId,
    );

    if (!result) {
      return [];
    }

    const [, entries] = result[0];
    return entries.map(([id, fields]) => {
      const record = this.fieldsToRecord(fields);
      return {
        id,
        type: record.type ?? 'token',
        data: record.data === undefined ? undefined : this.tryParseJson(record.data),
      };
    });
  }

  private fieldsToRecord(fields: string[]): Record<string, string> {
    const record: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      record[fields[i]] = fields[i + 1];
    }
    return record;
  }

  private tryParseJson(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
}
