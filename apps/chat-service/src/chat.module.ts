import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  RedisClusterModule,
  RedisChatZsetRepository,
  ShardedPubSubService,
  IPubSubPort,
} from '@libs/rpc/chat-realtime';
import { MessageService } from './message/message.service';
import { ChatNotifyListener } from './message/chat-notify.listener';
import { ChatServerConfig } from './config/chat-server-config';
import { IChatMessageStore } from './message/domain/port/chat-message-store.port';
import { ChatMessageStoreAdapter } from './message/infrastructure/chat-message-store.adapter';
import { ChatGrpcController } from './message/rpc/chat.grpc-controller';

@Module({
  imports: [ChatServerConfig, EventEmitterModule.forRoot(), RedisClusterModule],
  controllers: [ChatGrpcController],
  providers: [
    MessageService,
    ChatNotifyListener,
    ShardedPubSubService,
    RedisChatZsetRepository,
    ChatMessageStoreAdapter,
    { provide: IChatMessageStore, useClass: ChatMessageStoreAdapter },
    { provide: IPubSubPort, useClass: ShardedPubSubService },
    {
      provide: 'CHAT_CONFIG',
      useValue: { maxMessagesPerRoom: 500 },
    },
    {
      provide: 'SHARD_COUNT',
      useValue: 10,
    },
  ],
})
export class ChatModule {}
