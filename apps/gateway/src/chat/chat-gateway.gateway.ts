import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom } from 'rxjs';
import {
  ChatServiceClient,
  ChatMessage as ChatMessageReply,
  toMetadata,
  IPubSubPort,
  RedisChatZsetRepository,
  buildMessageBatch,
} from '@libs/rpc';
import { Session } from '@libs/shared-kernel';
import * as flatbuffers from 'flatbuffers';
import * as Chat from '@libs/rpc/flatbuffers';

const MAX_PULL_COUNT = 200;
const DEFAULT_HISTORY_LIMIT = 50;

@WebSocketGateway({
  namespace: '/chat/ws',
  transports: ['websocket'],
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ChatGateway.name);
  private chatService: ChatServiceClient;

  // Pod-local 상태 (방별 마지막으로 emit한 시각, 중복 pull 방지 큐)
  private readonly roomLastFlushed = new Map<string, number>();
  private readonly roomQueue = new Map<string, Promise<void>>();

  @WebSocketServer()
  private server: Server;

  constructor(
    @Inject('CHAT_SERVICE') private readonly client: ClientGrpc,
    @Inject(IPubSubPort) private readonly pubSubService: IPubSubPort,
    private readonly zsetRepo: RedisChatZsetRepository,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit() {
    this.chatService = this.client.getService<ChatServiceClient>('ChatService');

    // chat-service가 메시지 저장 후 발행하는 샤드 알림을 구독해 실제 연결된 소켓으로 emit한다.
    await this.pubSubService.subscribeAll();
    this.pubSubService.onMessage((roomId) => this.enqueueShardMessage(roomId));
  }

  onModuleDestroy() {
    this.roomLastFlushed.clear();
    this.roomQueue.clear();
  }

  afterInit(server: Server) {
    this.logger.log('Gateway Chat Socket.IO Gateway initialized');
  }

  handleConnection(client: Socket) {
    const token = client.handshake?.auth?.token || client.handshake?.query?.token;
    if (!token) {
      this.logger.warn(`Unauthenticated connection attempt: ${client.id}`);
      client.disconnect(true);
      return;
    }

    try {
      const payload: any = this.jwtService.verify(token);
      client.data.user = {
        uuid: payload.uuid ?? String(payload.id),
        nickName: payload.nickName ?? payload.name,
        id: payload.id ?? 0,
      };
      this.logger.log(`Client connected to gateway: ${client.id}`);
    } catch (err: unknown) {
      this.logger.warn(`Invalid or expired token for connection: ${client.id}`, err);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from gateway: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; historyLimit?: number },
  ) {
    const { roomId } = data;
    if (!roomId) return { success: false, error: 'Invalid roomId' };

    await client.join(roomId);
    this.initRoomLastFlushed(roomId);

    const limit = data.historyLimit ?? DEFAULT_HISTORY_LIMIT;
    let messages: ChatMessageReply[] = [];
    try {
      const reply = await firstValueFrom(
        this.chatService.getMessages({ roomId, limit }),
      );
      // getMessagesBefore는 최신순으로 오므로 화면 표시를 위해 오래된 순으로 뒤집는다
      messages = [...reply.messages].reverse();
    } catch (err: unknown) {
      this.logger.error(`Failed to load chat history for room ${roomId}:`, err);
    }

    return { success: true, messages };
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    await client.leave(data.roomId);
    this.cleanupRoom(data.roomId);
    return { success: true };
  }

  /**
   * 방별 처리 큐 (동시 알림 중복 pull 방지)
   */
  private enqueueShardMessage(roomId: string): void {
    const prev = this.roomQueue.get(roomId) ?? Promise.resolve();
    const next = prev
      .then(() => this.onShardMessage(roomId))
      .catch((err) =>
        this.logger.error(`Error processing shard message for room ${roomId}:`, err),
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
    const since = this.roomLastFlushed.get(roomId);
    if (since === undefined) {
      // 안전 fallback: 현재 시각으로 초기화하고 이번 알림은 skip
      this.initRoomLastFlushed(roomId);
      return;
    }

    // 3. Redis ZSET에서 since 이후 메시지 Pull
    const messages = await this.zsetRepo.getMessagesSince(roomId, since, MAX_PULL_COUNT);
    if (messages.length === 0) {
      return;
    }

    // 4. 로컬 Emit (FlatBuffers MessageBatch 빌드)
    let latestTs = since;
    messages.forEach((buf) => {
      const chatMsg = Chat.ChatMessage.getRootAsChatMessage(new flatbuffers.ByteBuffer(buf));
      const ts = Number(chatMsg.eventTimestamp());
      if (ts > latestTs) latestTs = ts;
    });

    const batchBuffer = Buffer.from(buildMessageBatch(messages, latestTs));
    this.server.to(roomId).emit('new_messages', roomId, batchBuffer);

    // 5. roomLastFlushed 갱신
    this.updateRoomLastFlushed(roomId, latestTs);
  }

  private initRoomLastFlushed(roomId: string, ts?: number): void {
    if (!this.roomLastFlushed.has(roomId)) {
      this.roomLastFlushed.set(roomId, ts ?? Date.now() * 1000);
    }
  }

  private updateRoomLastFlushed(roomId: string, ts: number): void {
    const current = this.roomLastFlushed.get(roomId) ?? 0;
    if (ts > current) {
      this.roomLastFlushed.set(roomId, ts);
    }
  }

  private cleanupRoom(roomId: string): void {
    const adapter = this.server.adapter as any;
    const room = adapter.rooms.get(roomId);
    if (!room || room.size === 0) {
      this.roomLastFlushed.delete(roomId);
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payloadBuffer: Buffer,
  ) {
    let payload: Chat.SendMessageRequest;
    try {
      const bb = new flatbuffers.ByteBuffer(new Uint8Array(payloadBuffer));
      payload = Chat.SendMessageRequest.getRootAsSendMessageRequest(bb);
    } catch (err) {
      return { success: false, error: 'Invalid FlatBuffer payload' };
    }

    const roomId = payload.roomId();
    const content = payload.content();

    if (!roomId || !content) {
      return { success: false, error: 'roomId and content are required' };
    }

    if (!client.rooms.has(roomId)) {
      return { success: false, error: 'join_room required' };
    }

    const user = client.data.user;
    if (!user) {
      return { success: false, error: 'Authentication failed' };
    }

    const session = Session.create({
      uuid: user.uuid,
      nickName: user.nickName,
      gameDbId: user.id,
      database: 'game_db',
    });

    const metadata = toMetadata(session);

    try {
      await firstValueFrom(
        this.chatService.saveMessage(
          {
            roomId,
            senderUuid: user.uuid,
            content,
          },
          metadata,
        ),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save message';
      return { success: false, error: msg };
    }

    return { success: true };
  }
}
