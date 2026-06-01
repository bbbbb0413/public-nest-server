import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server } from 'socket.io';
import * as flatbuffers from 'flatbuffers';
import * as Chat from '../flatbuffers/generated/chat';
import { buildMessageBatch } from '../flatbuffers/builders';
import { IPubSubPort } from '../message/domain/port/pub-sub.port';
import { MessageService } from '../message/message.service';
import {
  CHAT_SOCKET_NOTIFY,
  MAX_PULL_COUNT,
} from '../message/message.constants';

@Injectable()
export class SocketConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SocketConnectionService.name);
  private server: Server;

  // Pod-local 상태
  private readonly roomLastFlushed = new Map<string, number>();
  private readonly roomQueue = new Map<string, Promise<void>>();

  constructor(
    @Inject(IPubSubPort)
    private readonly pubSubService: IPubSubPort,
    private readonly messageService: MessageService,
  ) {}

  async onModuleInit() {
    await this.pubSubService.subscribeAll();
    this.pubSubService.onMessage((roomId) => this.enqueueShardMessage(roomId));
  }

  async onModuleDestroy() {
    this.roomLastFlushed.clear();
    this.roomQueue.clear();
  }

  setServer(server: Server) {
    this.server = server;
  }

  /**
   * 로컬 MessageService에서 알림 발생 시 ShardedPubSub으로 전파
   */
  @OnEvent(CHAT_SOCKET_NOTIFY)
  async handleSocketNotify(payload: { roomId: string }) {
    await this.pubSubService.publish(payload.roomId);
  }

  /**
   * 방별 처리 큐 (동시 알림 중복 pull 방지)
   */
  private enqueueShardMessage(roomId: string): void {
    const prev = this.roomQueue.get(roomId) ?? Promise.resolve();
    const next = prev
      .then(() => this.onShardMessage(roomId))
      .catch((err) =>
        this.logger.error(
          `Error processing shard message for room ${roomId}:`,
          err,
        ),
      )
      .finally(() => {
        if (this.roomQueue.get(roomId) === next) {
          this.roomQueue.delete(roomId);
        }
      });
    this.roomQueue.set(roomId, next);
  }

  /**
   * 실제 알림 처리: 로컬 Room 존재 확인 -> ZSET Pull -> 로컬 Emit
   */
  private async onShardMessage(roomId: string): Promise<void> {
    // 1. 로컬 Room에 소켓이 있는지 확인 (Socket.IO 어댑터 활용)
    const adapter = this.server.adapter as any;
    const room = adapter.rooms.get(roomId);
    if (!room || room.size === 0) {
      return;
    }

    // 2. roomLastFlushed 확인
    let since = this.roomLastFlushed.get(roomId);
    if (since === undefined) {
      // 안전 fallback: 현재 시각으로 초기화하고 이번 알림은 skip
      this.initRoomLastFlushed(roomId);
      return;
    }

    // 3. Redis ZSET에서 since 이후 메시지 Pull
    const messages = await this.messageService.getEventsSince(
      roomId,
      since,
      MAX_PULL_COUNT,
    );
    if (messages.length === 0) {
      return;
    }

    // 4. 로컬 Emit (FlatBuffers MessageBatch 빌드)
    let latestTs = since;
    messages.forEach((buf) => {
      const chatMsg = Chat.ChatMessage.getRootAsChatMessage(
        new flatbuffers.ByteBuffer(buf),
      );
      const ts = Number(chatMsg.eventTimestamp());
      if (ts > latestTs) latestTs = ts;
    });

    const batchBuffer = Buffer.from(buildMessageBatch(messages, latestTs));
    this.server.to(roomId).emit('new_messages', roomId, batchBuffer);

    // 5. roomLastFlushed 갱신
    this.updateRoomLastFlushed(roomId, latestTs);
  }

  initRoomLastFlushed(roomId: string, ts?: number): void {
    if (!this.roomLastFlushed.has(roomId)) {
      this.roomLastFlushed.set(roomId, ts ?? Date.now() * 1000);
    }
  }

  updateRoomLastFlushed(roomId: string, ts: number): void {
    const current = this.roomLastFlushed.get(roomId) ?? 0;
    if (ts > current) {
      this.roomLastFlushed.set(roomId, ts);
    }
  }

  cleanupRoom(roomId: string): void {
    const adapter = this.server.adapter as any;
    const room = adapter.rooms.get(roomId);
    if (!room || room.size === 0) {
      this.roomLastFlushed.delete(roomId);
    }
  }
}
