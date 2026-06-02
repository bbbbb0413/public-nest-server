import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisClusterModule } from './infrastructure/redis/redis-cluster.module';
import { RedisChatZsetRepository } from './infrastructure/redis/redis-chat-zset.repository';
import { ChatGateway } from './socket/chat.gateway';
import { SocketConnectionService } from './socket/socket-connection.service';
import { MessageService } from './message/message.service';
import { ShardedPubSubService } from './pubsub/sharded-pubsub.service';
import { ChatServerConfig } from './config/chat-server-config';
import { IChatMessageStore } from './message/domain/port/chat-message-store.port';
import { IPubSubPort } from './message/domain/port/pub-sub.port';
import { ChatMessageStoreAdapter } from './message/infrastructure/chat-message-store.adapter';
import { ChatGrpcController } from './message/rpc/chat.grpc-controller';

@Module({
  imports: [ChatServerConfig, EventEmitterModule.forRoot(), RedisClusterModule],
  controllers: [ChatGrpcController],
  providers: [
    SocketConnectionService,
    MessageService,
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
