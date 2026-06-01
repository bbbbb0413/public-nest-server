import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IChatMessageStore } from './domain/port/chat-message-store.port';
import { CHAT_SOCKET_NOTIFY, CHAT_SSE_NOTIFY } from './message.constants';

@Injectable()
export class MessageService {
  constructor(
    @Inject(IChatMessageStore)
    private readonly store: IChatMessageStore,
    private readonly eventEmitter: EventEmitter2,
    @Inject('CHAT_CONFIG')
    private readonly config: { maxMessagesPerRoom: number },
  ) {}

  async persistAndNotify(
    roomId: string,
    message: Buffer,
    eventTimestamp: number,
    channel: 'socket' | 'sse',
  ): Promise<void> {
    await this.store.addMessage(roomId, message, eventTimestamp);
    await this.store.trimMessages(roomId, this.config.maxMessagesPerRoom);

    const eventName =
      channel === 'socket' ? CHAT_SOCKET_NOTIFY : CHAT_SSE_NOTIFY;
    this.eventEmitter.emit(eventName, { roomId });
  }

  async getEventsSince(
    roomId: string,
    since: number,
    limit: number,
  ): Promise<Buffer[]> {
    return this.store.getMessagesSince(roomId, since, limit);
  }

  async getHistory(
    roomId: string,
    before: number,
    limit: number,
  ): Promise<Buffer[]> {
    return this.store.getMessagesBefore(roomId, before, limit);
  }
}
