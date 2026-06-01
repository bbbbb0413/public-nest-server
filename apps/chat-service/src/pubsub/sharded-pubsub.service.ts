import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { getChatShardChannel } from '../infrastructure/redis/chat.keys';
import { IPubSubPort } from '../message/domain/port/pub-sub.port';

@Injectable()
export class ShardedPubSubService
  implements OnModuleInit, OnModuleDestroy, IPubSubPort
{
  private readonly logger = new Logger(ShardedPubSubService.name);
  private messageCallback: (roomId: string) => void;

  constructor(
    @Inject('CHAT_REDIS_COMMAND_CLIENT')
    private readonly pubClient: Redis,
    @Inject('CHAT_REDIS_PUBSUB_CLIENT')
    private readonly subClient: Redis,
    @Inject('SHARD_COUNT')
    private readonly shardCount: number,
  ) {}

  async onModuleInit() {
    // 자동 구독은 SocketConnectionService에서 제어할 수도 있지만,
    // 명세서에 따라 모든 샤드를 고정 구독합니다.
  }

  async onModuleDestroy() {
    await this.unsubscribeAll();
  }

  /**
   * 특정 방에 대한 경량 알림(~30B, roomId만)을 발행합니다.
   */
  async publish(roomId: string): Promise<void> {
    const channel = getChatShardChannel(roomId, this.shardCount);
    await this.pubClient.publish(channel, roomId);
  }

  /**
   * 모든 샤드 채널을 구독합니다.
   */
  async subscribeAll(): Promise<void> {
    const channels = Array.from({ length: this.shardCount }, (_, i) =>
      getChatShardChannel(i),
    );
    await Promise.all(channels.map((ch) => this.subClient.subscribe(ch)));
    this.logger.log(`Subscribed to ${this.shardCount} shards`);
  }

  /**
   * 모든 샤드 채널 구독을 해지합니다.
   */
  async unsubscribeAll(): Promise<void> {
    const channels = Array.from({ length: this.shardCount }, (_, i) =>
      getChatShardChannel(i),
    );
    await Promise.allSettled(
      channels.map((ch) => this.subClient.unsubscribe(ch)),
    );
    this.logger.log(`Unsubscribed from all shards`);
  }

  /**
   * 메시지 수신 시 실행할 콜백을 등록합니다.
   */
  onMessage(callback: (roomId: string) => void): void {
    this.messageCallback = callback;
    this.subClient.on('message', (channel, message) => {
      if (channel.startsWith('chat:ws:shard:')) {
        this.messageCallback(message);
      }
    });
  }
}
