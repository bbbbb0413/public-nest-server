import { ChatGateway } from './chat-gateway.gateway';
import { Socket } from 'socket.io';
import { of, throwError } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import * as flatbuffers from 'flatbuffers';
import * as Chat from '@libs/rpc/flatbuffers';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let mockClientGrpc: any;
  let mockChatServiceClient: any;
  let mockPubSubService: any;
  let mockZsetRepo: any;
  let mockJwtService: jest.Mocked<Partial<JwtService>>;

  beforeEach(async () => {
    mockChatServiceClient = {
      getMessages: jest.fn(),
      saveMessage: jest.fn(),
    };

    mockClientGrpc = {
      getService: jest.fn().mockReturnValue(mockChatServiceClient),
    };

    mockPubSubService = {
      subscribeAll: jest.fn().mockResolvedValue(undefined),
      onMessage: jest.fn(),
    };

    mockZsetRepo = {
      getMessagesSince: jest.fn(),
    };

    mockJwtService = {
      verify: jest.fn(),
    };

    gateway = new ChatGateway(
      mockClientGrpc,
      mockPubSubService,
      mockZsetRepo,
      mockJwtService as unknown as JwtService,
    );

    await gateway.onModuleInit();
  });

  describe('handleConnection', () => {
    it('토큰이 누락된 경우 연결을 차단(disconnect)하고 client.data.user를 설정하지 않아야 한다', () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-1',
        handshake: {
          auth: {},
          query: {},
        } as any,
        data: {},
        disconnect: jest.fn(),
      };

      gateway.handleConnection(mockSocket as Socket);

      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
      expect(mockSocket.data.user).toBeUndefined();
    });

    it('토큰이 만료되었거나 검증에 실패하면 연결을 차단하고 client.data.user를 설정하지 않아야 한다', () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-2',
        handshake: {
          auth: { token: 'invalid-token' },
          query: {},
        } as any,
        data: {},
        disconnect: jest.fn(),
      };

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      gateway.handleConnection(mockSocket as Socket);

      expect(mockJwtService.verify).toHaveBeenCalledWith('invalid-token');
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
      expect(mockSocket.data.user).toBeUndefined();
    });

    it('유효한 JWT 토큰인 경우 client.data.user에 uuid, nickName, id를 정규화하여 주입해야 한다', () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-3',
        handshake: {
          auth: { token: 'valid-token' },
          query: {},
        } as any,
        data: {},
        disconnect: jest.fn(),
      };

      mockJwtService.verify.mockReturnValue({
        id: 42,
        name: '홍길동',
        email: 'user@test.com',
      });

      gateway.handleConnection(mockSocket as Socket);

      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
      expect(mockSocket.data.user).toEqual({
        uuid: '42',
        nickName: '홍길동',
        id: 42,
      });
    });

    it('JWT payload에 uuid와 nickName이 직접 포함된 경우 해당 값을 우선 사용하여 주입해야 한다', () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-4',
        handshake: {
          auth: {},
          query: { token: 'custom-token' },
        } as any,
        data: {},
        disconnect: jest.fn(),
      };

      mockJwtService.verify.mockReturnValue({
        id: 100,
        uuid: 'custom-uuid-100',
        nickName: '커스텀닉네임',
        name: '기본이름',
      });

      gateway.handleConnection(mockSocket as Socket);

      expect(mockJwtService.verify).toHaveBeenCalledWith('custom-token');
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
      expect(mockSocket.data.user).toEqual({
        uuid: 'custom-uuid-100',
        nickName: '커스텀닉네임',
        id: 100,
      });
    });
  });

  describe('handleSendMessage', () => {
    const buildFlatBufferPayload = (roomId: string, content: string): Buffer => {
      const builder = new flatbuffers.Builder(1024);
      const roomOffset = builder.createString(roomId);
      const contentOffset = builder.createString(content);
      const metadataOffset = builder.createString('');

      const offset = Chat.SendMessageRequest.createSendMessageRequest(
        builder,
        roomOffset,
        contentOffset,
        metadataOffset,
      );
      builder.finish(offset);
      return Buffer.from(builder.asUint8Array());
    };

    it('인증 정보(client.data.user)가 없는 경우 Authentication failed 에러를 반환해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-5',
        rooms: new Set(['lobby']),
        data: {},
      };

      const payload = buildFlatBufferPayload('lobby', '안녕하세요');
      const result = await gateway.handleSendMessage(mockSocket as Socket, payload);

      expect(result).toEqual({ success: false, error: 'Authentication failed' });
    });

    it('방에 입장하지 않은 경우 join_room required 에러를 반환해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-6',
        rooms: new Set([]),
        data: {
          user: { uuid: 'user-1', nickName: '유저1', id: 1 },
        },
      };

      const payload = buildFlatBufferPayload('lobby', '안녕하세요');
      const result = await gateway.handleSendMessage(mockSocket as Socket, payload);

      expect(result).toEqual({ success: false, error: 'join_room required' });
    });

    it('정상적인 인증 정보와 방 입장 상태에서 메시지 전송 시 gRPC saveMessage를 호출하고 성공을 반환해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-7',
        rooms: new Set(['lobby']),
        data: {
          user: { uuid: 'user-1', nickName: '유저1', id: 1 },
        },
      };

      mockChatServiceClient.saveMessage.mockReturnValue(
        of({ messageId: 'msg-123', createdAt: Date.now() }),
      );

      const payload = buildFlatBufferPayload('lobby', '테스트 메시지');
      const result = await gateway.handleSendMessage(mockSocket as Socket, payload);

      expect(result).toEqual({ success: true });
      expect(mockChatServiceClient.saveMessage).toHaveBeenCalledWith(
        {
          roomId: 'lobby',
          senderUuid: 'user-1',
          content: '테스트 메시지',
        },
        expect.anything(),
      );
    });

    it('gRPC saveMessage 실패 시 에러 메시지를 반환해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-8',
        rooms: new Set(['lobby']),
        data: {
          user: { uuid: 'user-1', nickName: '유저1', id: 1 },
        },
      };

      mockChatServiceClient.saveMessage.mockReturnValue(
        throwError(() => new Error('gRPC connection error')),
      );

      const payload = buildFlatBufferPayload('lobby', '테스트 메시지');
      const result = await gateway.handleSendMessage(mockSocket as Socket, payload);

      expect(result).toEqual({ success: false, error: 'gRPC connection error' });
    });
  });
});
