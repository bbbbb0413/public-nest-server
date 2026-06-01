import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';
import { RedisChatRepository } from '../infrastructure/redis/chat/redis-chat.repository';
import { sleep } from '@libs/common/utils/time.util';
import {
  Chat,
  Connection,
} from '../infrastructure/redis/chat/redis-chat.entity';
import * as jwt from 'jsonwebtoken';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  CHAT_HISTORY_PREFIX,
  CHAT_ROOM_PREFIX,
  CHAT_SOCKET_TTL,
} from '@libs/common/constants/chat.constants';

@WebSocketGateway(Number(process.env.SOCKET_PORT), { cors: '*' })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    @InjectQueue('test') private readonly queue: Queue,
    private readonly redisChatRepository: RedisChatRepository,
  ) {}
  @WebSocketServer()
  server: Server;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/no-empty-function
  async afterInit(server: Server): Promise<void> {}

  async handleConnection(client: Socket): Promise<void> {
    const userId = this.getUserId(client);
    const connection = await this.getConnection(userId);

    if (connection.socketId === client.id) {
      client.disconnect(true);
      return;
    }

    connection.socketId = client.id;
    if (connection.room) {
      client.join(connection.room);
      this.server.to(connection.room).emit('userJoined', {
        nickName: connection.nickName,
      });
    }

    await this.setConnection(userId, connection);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = this.getUserId(client);
    const connection = await this.getConnection(userId);
    if (connection.room) {
      const roomUsers = await this.getRoom(connection.room);
      const index = roomUsers.indexOf(userId);
      if (-1 !== index) {
        roomUsers.splice(index, 1);
        if (roomUsers.length) {
          await this.setRoom(connection.room, roomUsers);
        } else {
          await this.delRoom(connection.room);
        }
      }
      this.server.to(connection.room).emit('userLeft', {
        userId: connection.nickName,
      });

      this.server.to(connection.room).emit('userList', {
        room: connection.room,
        userList: roomUsers,
      });
    }

    await this.delConnection(userId);
    client.disconnect(true);
  }

  @SubscribeMessage('setUserNick')
  async handleSetUserNick(client: Socket, nick: string): Promise<void> {
    const userId = this.getUserId(client);
    const connection = await this.getConnection(userId);
    connection.nickName = nick;

    await this.setConnection(userId, connection);
  }

  @SubscribeMessage('join')
  async handleJoin(client: Socket, room: string): Promise<void> {
    const roomUsers = await this.getRoom(room);
    if (client.rooms.has(room)) {
      this.server.to(room).emit('userList', { room, userList: roomUsers });
      return;
    }

    client.join(room);

    const userId = this.getUserId(client);
    const isExist = roomUsers.includes(userId);
    if (!isExist) {
      roomUsers.push(userId);
    }

    await this.setRoom(room, roomUsers);

    const connection = await this.getConnection(userId);
    connection.room = room;

    await this.setConnection(userId, connection);

    const chatHistory = await this.getChatHistory(room);

    this.server.to(room).emit('userJoined', {
      userId: userId,
      nickName: connection.nickName,
      chatHistory: chatHistory,
    });
    this.server.to(room).emit('userList', { room, userList: roomUsers });
  }

  @SubscribeMessage('exit')
  async handleExit(client: Socket, room: string): Promise<void> {
    if (!client.rooms.has(room)) {
      return;
    }

    client.leave(room);

    const roomUsers = await this.getRoom(room);

    const userId = this.getUserId(client);

    const index = roomUsers.indexOf(userId);

    if (index !== -1) {
      roomUsers.splice(index, 1);
      if (roomUsers.length) {
        await this.setRoom(room, roomUsers);
      } else {
        await this.delRoom(room);
      }

      const connection = await this.getConnection(userId);
      connection.room = '';

      await this.setConnection(userId, connection);

      this.server.to(room).emit('userLeft', {
        nickName: connection.nickName,
      });

      this.server.to(room).emit('userList', { room, userList: roomUsers });
    }
  }

  @SubscribeMessage('getUserList')
  async handleGetUserList(client: Socket, room: string): Promise<void> {
    const userId = this.getUserId(client);
    const connection = await this.getConnection(userId);
    const roomUsers = await this.getRoom(connection.room);

    this.server.to(room).emit('userList', { room, userList: roomUsers });
  }

  @SubscribeMessage('chatMessage')
  async handleChatMessage(
    client: Socket,
    data: { message: string },
  ): Promise<void> {
    const userId = this.getUserId(client);
    const connection = await this.getConnection(userId);

    const chat = Chat.create({
      userId: userId,
      nickName: connection.nickName,
      message: data.message,
    });

    this.server.to(connection.room).emit('chatMessage', chat);

    const chatName = this.getChatName(connection.room);
    await this.setChatHistory(connection.room, chat);

    const jobs = { chatHistoryKey: chatName };
    await this.queue.add('chat', jobs);
  }

  // redis ttl 갱신을 위한 ping
  @SubscribeMessage('ping')
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async handlePing(): Promise<void> {}

  @SubscribeMessage('refresh-auth')
  handleRefreshAuth(client: Socket, token: string): void {
    if (!token) {
      client.disconnect(true);
    } else {
      try {
        client.data.user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        client.handshake.auth.token = token;
      } catch {
        client.disconnect(true);
      }
    }
  }

  async getConnection(clientId: string): Promise<Connection> {
    return (
      ((await this.redisChatRepository.getKey(clientId)) as Connection) ||
      Connection.create()
    );
  }

  async setConnection(clientId: string, connection: Connection): Promise<void> {
    await this.redisChatRepository.setKey(
      clientId,
      connection,
      CHAT_SOCKET_TTL,
    );
  }

  async delConnection(clientId: string): Promise<void> {
    await this.redisChatRepository.delKey(clientId);
  }

  async getRoom(room: string): Promise<string[]> {
    const roomName = this.getRoomName(room);
    return (
      ((await this.redisChatRepository.getKey(roomName)) as string[]) || []
    );
  }

  async setRoom(room: string, users: string[]): Promise<void> {
    const roomName = this.getRoomName(room);
    await this.redisChatRepository.setKey(roomName, users);
  }

  async delRoom(room: string): Promise<void> {
    const roomName = this.getRoomName(room);
    await this.redisChatRepository.delKey(roomName);
  }

  async getChatHistory(room: string): Promise<string[]> {
    const chatName = this.getChatName(room);
    return this.redisChatRepository.getAllChat(chatName);
  }

  async setChatHistory(room: string, value: Chat): Promise<void> {
    const chatName = this.getChatName(room);
    return await this.redisChatRepository.saveChat(chatName, value);
  }

  getUserId(client: Socket): string {
    return client.handshake.query.userId as string;
  }

  getRoomName(room: string): string {
    return CHAT_ROOM_PREFIX + room;
  }

  getChatName(room: string): string {
    return CHAT_HISTORY_PREFIX + room;
  }
}
