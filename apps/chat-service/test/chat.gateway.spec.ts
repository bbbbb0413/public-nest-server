import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from '../src/socket/chat.gateway';
import { MessageService } from '../src/message/message.service';
import { SocketConnectionService } from '../src/socket/socket-connection.service';
import { Socket } from 'socket.io';
import * as flatbuffers from 'flatbuffers';
import * as Chat from '../src/flatbuffers/generated/chat';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let mockMessageService: any;
  let mockSocketConnService: any;
  let mockSocket: any;

  beforeEach(async () => {
    mockMessageService = {
      persistAndNotify: jest.fn().mockResolvedValue(undefined),
      getEventsSince: jest.fn().mockResolvedValue([]),
    };
    mockSocketConnService = {
      initRoomLastFlushed: jest.fn(),
      updateRoomLastFlushed: jest.fn(),
      cleanupRoom: jest.fn(),
    };
    mockSocket = {
      id: 'socket-id',
      data: { userId: 'user-1' },
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      rooms: new Set(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: MessageService,
          useValue: mockMessageService,
        },
        {
          provide: SocketConnectionService,
          useValue: mockSocketConnService,
        },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
  });

  it('join_room 요청을 처리해야 한다', async () => {
    const data = { roomId: 'lobby' };
    const result = await gateway.handleJoinRoom(mockSocket, data);

    expect(mockSocket.join).toHaveBeenCalledWith('lobby');
    expect(mockSocketConnService.initRoomLastFlushed).toHaveBeenCalledWith('lobby');
    expect(result).toEqual({ success: true });
  });

  it('send_message 요청을 처리해야 한다', async () => {
    const builder = new flatbuffers.Builder(256);
    const roomIdOffset = builder.createString('lobby');
    const contentOffset = builder.createString('hello');
    const metadataOffset = builder.createString('');
    const requestOffset = Chat.SendMessageRequest.createSendMessageRequest(
      builder,
      roomIdOffset,
      contentOffset,
      metadataOffset,
    );
    builder.finish(requestOffset);
    const payloadBuffer = Buffer.from(builder.asUint8Array());

    // 소켓이 이미 방에 참여 중이라고 가정
    mockSocket.rooms.add('lobby');

    const result = await gateway.handleSendMessage(mockSocket, payloadBuffer);

    expect(mockMessageService.persistAndNotify).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('방에 참여하지 않고 메시지 전송 시 에러를 반환해야 한다', async () => {
    const builder = new flatbuffers.Builder(256);
    const roomIdOffset = builder.createString('lobby');
    const contentOffset = builder.createString('hello');
    const metadataOffset = builder.createString('');
    const requestOffset = Chat.SendMessageRequest.createSendMessageRequest(
      builder,
      roomIdOffset,
      contentOffset,
      metadataOffset,
    );
    builder.finish(requestOffset);
    const payloadBuffer = Buffer.from(builder.asUint8Array());

    const result = await gateway.handleSendMessage(mockSocket, payloadBuffer);

    expect(result).toEqual({ success: false, error: 'join_room required' });
  });
});
