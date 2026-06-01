import { Injectable } from '@nestjs/common';
import { RedisChatZsetRepository } from '../../infrastructure/redis/redis-chat-zset.repository';
import { IChatMessageStore } from '../domain/port/chat-message-store.port';

@Injectable()
export class ChatMessageStoreAdapter implements IChatMessageStore {
  constructor(private readonly zsetRepo: RedisChatZsetRepository) {}

  addMessage(
    roomId: string,
    message: Buffer,
    timestamp: number,
  ): Promise<void> {
    return this.zsetRepo.addMessage(roomId, message, timestamp);
  }

  getMessagesSince(
    roomId: string,
    since: number,
    limit: number,
  ): Promise<Buffer[]> {
    return this.zsetRepo.getMessagesSince(roomId, since, limit);
  }

  trimMessages(roomId: string, maxMessages: number): Promise<void> {
    return this.zsetRepo.trimMessages(roomId, maxMessages);
  }

  getMessagesBefore(
    roomId: string,
    before: number,
    limit: number,
  ): Promise<Buffer[]> {
    return this.zsetRepo.getMessagesBefore(roomId, before, limit);
  }
}
