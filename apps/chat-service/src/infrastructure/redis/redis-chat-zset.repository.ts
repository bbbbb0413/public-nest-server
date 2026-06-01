import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { getChatZsetKey } from './chat.keys';

@Injectable()
export class RedisChatZsetRepository {
  constructor(
    @Inject('CHAT_REDIS_COMMAND_CLIENT')
    private readonly redis: Redis,
  ) {}

  /**
   * 메시지를 ZSET에 추가합니다.
   * score는 eventTimestamp(마이크로초)를 사용합니다.
   */
  async addMessage(
    roomId: string,
    message: Buffer,
    timestamp: number,
  ): Promise<void> {
    const key = getChatZsetKey(roomId);
    await this.redis.zadd(key, timestamp, message);
  }

  /**
   * 지정된 timestamp(since) 이후의 메시지들을 가져옵니다. (since 미포함)
   */
  async getMessagesSince(
    roomId: string,
    since: number,
    limit: number,
  ): Promise<Buffer[]> {
    const key = getChatZsetKey(roomId);
    // '(' 기호는 exclusive (미포함)를 의미함
    return this.redis.zrangebyscoreBuffer(
      key,
      `(${since}`,
      '+inf',
      'LIMIT',
      0,
      limit,
    );
  }

  /**
   * 방의 메시지 개수를 일정 수준(maxMessages)으로 유지하기 위해 오래된 메시지를 삭제합니다.
   */
  async trimMessages(roomId: string, maxMessages: number): Promise<void> {
    const key = getChatZsetKey(roomId);
    // 0부터 뒤에서 (maxMessages + 1)번째까지 삭제하여 최신 maxMessages개만 남김
    await this.redis.zremrangebyrank(key, 0, -(maxMessages + 1));
  }

  /**
   * 특정 범위의 메시지를 역순으로 가져옵니다 (히스토리 조회용).
   */
  async getMessagesBefore(
    roomId: string,
    before: number,
    limit: number,
  ): Promise<Buffer[]> {
    const key = getChatZsetKey(roomId);
    // before 미포함, 역순 조회
    return this.redis.zrevrangebyscoreBuffer(
      key,
      `(${before}`,
      '-inf',
      'LIMIT',
      0,
      limit,
    );
  }
}
