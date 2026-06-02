import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ChatServiceClient, toMetadata } from '@libs/rpc';
import { Session } from '@libs/shared-kernel';
import * as flatbuffers from 'flatbuffers';
import * as Chat from '@libs/rpc/flatbuffers';

@WebSocketGateway({
  namespace: '/chat/ws',
  transports: ['websocket'],
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  private readonly logger = new Logger(ChatGateway.name);
  private chatService: ChatServiceClient;

  @WebSocketServer()
  private server: Server;

  constructor(
    @Inject('CHAT_SERVICE') private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.chatService = this.client.getService<ChatServiceClient>('ChatService');
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
    this.logger.log(`Client connected to gateway: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from gateway: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const { roomId } = data;
    if (!roomId) return { success: false, error: 'Invalid roomId' };

    await client.join(roomId);
    return { success: true };
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    await client.leave(data.roomId);
    return { success: true };
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
      uuid: String(user.id),
      nickName: user.name,
      gameDbId: user.id,
      database: 'game_db',
    });

    const metadata = toMetadata(session);

    try {
      await firstValueFrom(
        this.chatService.saveMessage(
          {
            roomId,
            senderUuid: String(user.id),
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
