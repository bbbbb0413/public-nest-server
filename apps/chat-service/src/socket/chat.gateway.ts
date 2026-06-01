import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseInterceptors } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { MessageService } from '../message/message.service';
import { SocketConnectionService } from './socket-connection.service';
import * as flatbuffers from 'flatbuffers';
import { buildChatMessage } from '../flatbuffers/builders';
import * as Chat from '../flatbuffers/generated/chat';

@WebSocketGateway({
  namespace: '/chat/ws',
  transports: ['websocket'],
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  private server: Server;

  constructor(
    private readonly messageService: MessageService,
    private readonly socketConnService: SocketConnectionService,
  ) {}

  afterInit(server: Server) {
    this.socketConnService.setServer(server);
    this.logger.log('Chat Socket.IO Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // disconnecting 이벤트에서 rooms 캡처가 필요할 수 있으나,
    // 여기서는 간단히 모든 참여했던 방에 대해 cleanup 시도
    // (실제로는 socket.data.joinedRooms 활용 권장)
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; lastTimestamp?: number },
  ) {
    const { roomId, lastTimestamp } = data;
    if (!roomId) return { success: false, error: 'Invalid roomId' };

    await client.join(roomId);

    if (lastTimestamp) {
      const messages = await this.messageService.getEventsSince(roomId, lastTimestamp, 200);
      if (messages.length > 0) {
        // catch-up 메시지 전송 로직 필요 (Batch 빌드 등)
        // 여기서는 생략하거나 간단히 처리
      }
      this.socketConnService.updateRoomLastFlushed(roomId, lastTimestamp);
    } else {
      this.socketConnService.initRoomLastFlushed(roomId);
    }

    return { success: true };
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
    await client.leave(data.roomId);
    this.socketConnService.cleanupRoom(data.roomId);
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
    const metadata = payload.metadata() || '';

    if (!client.rooms.has(roomId)) {
      return { success: false, error: 'join_room required' };
    }

    const eventTimestamp = Date.now() * 1000; // 마이크로초 근사
    const messageId = uuidv4();
    const userId = client.data.userId || 'anonymous';

    const messageBuffer = Buffer.from(
      buildChatMessage(
        messageId,
        Chat.MessageStatus.NORMAL,
        userId,
        content,
        metadata,
        Date.now(),
        eventTimestamp,
      ),
    );

    await this.messageService.persistAndNotify(roomId, messageBuffer, eventTimestamp, 'socket');

    return { success: true };
  }
}
