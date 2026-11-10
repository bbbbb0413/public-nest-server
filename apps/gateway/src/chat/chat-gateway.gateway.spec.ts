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
          senderNickname: '유저1',
        },
        expect.anything(),
      );
    });

    it('사용자 정보에 닉네임이 없는 경우에도 senderNickname에 빈 문자열 또는 undefined로 안전하게 전달해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-no-nickname',
        rooms: new Set(['lobby']),
        data: {
          user: { uuid: 'user-no-nick', id: 2 },
        },
      };

      mockChatServiceClient.saveMessage.mockReturnValue(
        of({ messageId: 'msg-no-nick', createdAt: Date.now() }),
      );

      const payload = buildFlatBufferPayload('lobby', '닉네임 없는 유저의 메시지');
      const result = await gateway.handleSendMessage(mockSocket as Socket, payload);

      expect(result).toEqual({ success: true });
      expect(mockChatServiceClient.saveMessage).toHaveBeenCalledWith(
        {
          roomId: 'lobby',
          senderUuid: 'user-no-nick',
          content: '닉네임 없는 유저의 메시지',
          senderNickname: undefined,
        },
        expect.anything(),
      );
    });

    it('Buffer가 아닌 데이터가 페이로드로 전달된 경우 Invalid FlatBuffer payload 에러를 반환해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-invalid-fb',
        rooms: new Set(['lobby']),
        data: {
          user: { uuid: 'user-1', nickName: '유저1', id: 1 },
        },
      };

      const invalidPayload = 'not-a-buffer' as any;
      const result = await gateway.handleSendMessage(mockSocket as Socket, invalidPayload);

      expect(result).toEqual({ success: false, error: 'Invalid FlatBuffer payload' });
    });

    it('roomId 또는 content가 누락된 FlatBuffer 메시지 전송 시 에러를 반환해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-missing-fields',
        rooms: new Set(['lobby']),
        data: {
          user: { uuid: 'user-1', nickName: '유저1', id: 1 },
        },
      };

      const emptyRoomPayload = buildFlatBufferPayload('', '내용');
      const result1 = await gateway.handleSendMessage(mockSocket as Socket, emptyRoomPayload);
      expect(result1).toEqual({ success: false, error: 'roomId and content are required' });

      const emptyContentPayload = buildFlatBufferPayload('lobby', '');
      const result2 = await gateway.handleSendMessage(mockSocket as Socket, emptyContentPayload);
      expect(result2).toEqual({ success: false, error: 'roomId and content are required' });
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

  describe('handleJoinRoom', () => {
    it('roomId가 누락된 경우 실패 응답을 반환해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-join-1',
        join: jest.fn(),
      };

      const result = await gateway.handleJoinRoom(mockSocket as Socket, { roomId: '' });
      expect(result).toEqual({ success: false, error: 'Invalid roomId' });
      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it('방 입장 시 대화 이력의 senderNickname 필드를 포함하여 반환해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-join-2',
        join: jest.fn().mockResolvedValue(undefined),
      };

      const mockMessages = [
        {
          messageId: 'msg-1',
          senderUuid: 'user-1',
          content: '첫번째 메시지',
          createdAt: 1000,
          senderNickname: '닉네임1',
        },
        {
          messageId: 'msg-2',
          senderUuid: 'user-2',
          content: '두번째 메시지',
          createdAt: 2000,
          senderNickname: '닉네임2',
        },
      ];

      mockChatServiceClient.getMessages.mockReturnValue(
        of({ messages: mockMessages }),
      );

      const result = await gateway.handleJoinRoom(mockSocket as Socket, {
        roomId: 'room-1',
        historyLimit: 10,
      });

      expect(mockSocket.join).toHaveBeenCalledWith('room-1');
      expect(mockChatServiceClient.getMessages).toHaveBeenCalledWith({
        roomId: 'room-1',
        limit: 10,
      });
      expect(result.success).toBe(true);
      // reverse되어 오래된 순으로 정렬됨
      expect(result.messages).toEqual([
        {
          messageId: 'msg-2',
          senderUuid: 'user-2',
          content: '두번째 메시지',
          createdAt: 2000,
          senderNickname: '닉네임2',
        },
        {
          messageId: 'msg-1',
          senderUuid: 'user-1',
          content: '첫번째 메시지',
          createdAt: 1000,
          senderNickname: '닉네임1',
        },
      ]);
    });

    it('대화 이력에 닉네임이 없는 레거시 메시지가 포함되어 있어도 정상적으로 응답해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-join-legacy',
        join: jest.fn().mockResolvedValue(undefined),
      };

      const mockLegacyMessages = [
        {
          messageId: 'msg-legacy-1',
          senderUuid: 'legacy-user-1',
          content: '과거 메시지',
          createdAt: 500,
          senderNickname: '',
        },
      ];

      mockChatServiceClient.getMessages.mockReturnValue(
        of({ messages: mockLegacyMessages }),
      );

      const result = await gateway.handleJoinRoom(mockSocket as Socket, {
        roomId: 'room-legacy',
      });

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({
        messageId: 'msg-legacy-1',
        senderUuid: 'legacy-user-1',
        content: '과거 메시지',
        createdAt: 500,
        senderNickname: '',
      });
    });
  });

  describe('handleFetchHistory', () => {
    it('roomId가 누락되었거나 유효하지 않은 경우 실패 응답을 반환해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-fetch-1',
        rooms: new Set(['room-1']),
      };

      const result = await gateway.handleFetchHistory(mockSocket as Socket, {
        roomId: '',
        before: 1700000000,
      });

      expect(result).toEqual({ success: false, error: 'Invalid roomId' });
      expect(mockChatServiceClient.getMessages).not.toHaveBeenCalled();
    });

    it('before 타임스탬프가 누락되었거나 유효하지 않은 경우 실패 응답을 반환해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-fetch-2',
        rooms: new Set(['room-1']),
      };

      const result1 = await gateway.handleFetchHistory(mockSocket as Socket, {
        roomId: 'room-1',
        before: undefined as any,
      });
      expect(result1).toEqual({ success: false, error: 'Invalid before timestamp' });

      const result2 = await gateway.handleFetchHistory(mockSocket as Socket, {
        roomId: 'room-1',
        before: NaN,
      });
      expect(result2).toEqual({ success: false, error: 'Invalid before timestamp' });
      expect(mockChatServiceClient.getMessages).not.toHaveBeenCalled();
    });

    it('방에 입장하지 않은 소켓 클라이언트가 요청한 경우 join_room required 실패 응답을 반환해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-fetch-3',
        rooms: new Set(['other-room']),
      };

      const result = await gateway.handleFetchHistory(mockSocket as Socket, {
        roomId: 'room-1',
        before: 1700000000,
      });

      expect(result).toEqual({ success: false, error: 'join_room required' });
      expect(mockChatServiceClient.getMessages).not.toHaveBeenCalled();
    });

    it('before 타임스탬프와 limit을 gRPC getMessages에 올바르게 전달해야 한다 (밀리초(ms)를 마이크로초(μs)로 변환, limit 미지정 시 기본값 50)', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-fetch-4',
        rooms: new Set(['room-1']),
      };

      mockChatServiceClient.getMessages.mockReturnValue(
        of({ messages: [] }),
      );

      const beforeMs = 1700000000123;
      const result = await gateway.handleFetchHistory(mockSocket as Socket, {
        roomId: 'room-1',
        before: beforeMs,
      });

      expect(mockChatServiceClient.getMessages).toHaveBeenCalledWith({
        roomId: 'room-1',
        limit: 50,
        before: beforeMs * 1000,
      });
      expect(result).toEqual({
        success: true,
        messages: [],
        hasMore: false,
      });
    });

    it('before 커서의 밀리초(ms) 타임스탬프를 마이크로초(μs, ms * 1000) 단위로 변환하여 gRPC getMessages에 전달해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-fetch-unit-conversion',
        rooms: new Set(['room-1']),
      };

      mockChatServiceClient.getMessages.mockReturnValue(
        of({ messages: [] }),
      );

      const timestampMs = 1715000000000;
      await gateway.handleFetchHistory(mockSocket as Socket, {
        roomId: 'room-1',
        before: timestampMs,
      });

      expect(mockChatServiceClient.getMessages).toHaveBeenCalledWith({
        roomId: 'room-1',
        limit: 50,
        before: timestampMs * 1000,
      });
    });

    it('조회된 메시지를 오래된 순으로 정렬하고 조회 수가 limit 이상인 경우 hasMore를 true로 반환해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-fetch-5',
        rooms: new Set(['room-1']),
      };

      const mockMessages = [
        {
          messageId: 'msg-2',
          senderUuid: 'user-2',
          content: '최신 과거 메시지',
          createdAt: 2000,
          senderNickname: '닉네임2',
        },
        {
          messageId: 'msg-1',
          senderUuid: 'user-1',
          content: '가장 오래된 메시지',
          createdAt: 1000,
          senderNickname: '닉네임1',
        },
      ];

      mockChatServiceClient.getMessages.mockReturnValue(
        of({ messages: mockMessages }),
      );

      const result = await gateway.handleFetchHistory(mockSocket as Socket, {
        roomId: 'room-1',
        before: 3000,
        limit: 2,
      });

      expect(mockChatServiceClient.getMessages).toHaveBeenCalledWith({
        roomId: 'room-1',
        limit: 2,
        before: 3000 * 1000,
      });
      expect(result.success).toBe(true);
      expect(result.hasMore).toBe(true);
      expect(result.messages).toEqual([
        {
          messageId: 'msg-1',
          senderUuid: 'user-1',
          content: '가장 오래된 메시지',
          createdAt: 1000,
          senderNickname: '닉네임1',
        },
        {
          messageId: 'msg-2',
          senderUuid: 'user-2',
          content: '최신 과거 메시지',
          createdAt: 2000,
          senderNickname: '닉네임2',
        },
      ]);
    });

    it('조회된 메시지 수가 limit 미만인 경우 hasMore를 false로 반환해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-fetch-6',
        rooms: new Set(['room-1']),
      };

      const mockMessages = [
        {
          messageId: 'msg-1',
          senderUuid: 'user-1',
          content: '단일 과거 메시지',
          createdAt: 1000,
          senderNickname: '닉네임1',
        },
      ];

      mockChatServiceClient.getMessages.mockReturnValue(
        of({ messages: mockMessages }),
      );

      const result = await gateway.handleFetchHistory(mockSocket as Socket, {
        roomId: 'room-1',
        before: 3000,
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.hasMore).toBe(false);
      expect(result.messages).toHaveLength(1);
    });

    it('gRPC getMessages 호출 실패 시 실패 응답을 반환해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-fetch-7',
        rooms: new Set(['room-1']),
      };

      mockChatServiceClient.getMessages.mockReturnValue(
        throwError(() => new Error('gRPC fetch failed')),
      );

      const result = await gateway.handleFetchHistory(mockSocket as Socket, {
        roomId: 'room-1',
        before: 1700000000,
      });

      expect(result).toEqual({ success: false, error: 'gRPC fetch failed' });
    });

    it('data 페이로드가 null 또는 undefined인 경우 크래시 없이 Invalid roomId를 반환해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-fetch-8',
        rooms: new Set(['room-1']),
      };

      const result1 = await gateway.handleFetchHistory(mockSocket as Socket, null as any);
      expect(result1).toEqual({ success: false, error: 'Invalid roomId' });

      const result2 = await gateway.handleFetchHistory(mockSocket as Socket, undefined as any);
      expect(result2).toEqual({ success: false, error: 'Invalid roomId' });
    });

    it('before 타임스탬프가 0 이하(0 또는 음수)인 경우 유효하지 않은 타임스탬프로 거부해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-fetch-9',
        rooms: new Set(['room-1']),
      };

      const resultZero = await gateway.handleFetchHistory(mockSocket as Socket, {
        roomId: 'room-1',
        before: 0,
      });
      expect(resultZero).toEqual({ success: false, error: 'Invalid before timestamp' });

      const resultNegative = await gateway.handleFetchHistory(mockSocket as Socket, {
        roomId: 'room-1',
        before: -1000,
      });
      expect(resultNegative).toEqual({ success: false, error: 'Invalid before timestamp' });
    });

    it('client.rooms가 undefined인 소켓 클라이언트 요청 시 join_room required를 반환해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-fetch-10',
        rooms: undefined,
      };

      const result = await gateway.handleFetchHistory(mockSocket as Socket, {
        roomId: 'room-1',
        before: 1700000000,
      });

      expect(result).toEqual({ success: false, error: 'join_room required' });
    });

    it('수용 기준 3: 과거 메시지 10건 조회 시 시간순(오래된 순) 정렬 및 hasMore: false를 반환해야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-fetch-11',
        rooms: new Set(['room-1']),
      };

      // 최신순으로 반환되는 10건의 모의 메시지 (timestamp 10 down to 1)
      const mock10Messages = Array.from({ length: 10 }, (_, i) => ({
        messageId: `msg-${10 - i}`,
        senderUuid: `user-${10 - i}`,
        content: `과거 메시지 ${10 - i}`,
        createdAt: (10 - i) * 1000,
        senderNickname: `유저${10 - i}`,
      }));

      mockChatServiceClient.getMessages.mockReturnValue(
        of({ messages: mock10Messages }),
      );

      const result = await gateway.handleFetchHistory(mockSocket as Socket, {
        roomId: 'room-1',
        before: 20000,
      });

      expect(mockChatServiceClient.getMessages).toHaveBeenCalledWith({
        roomId: 'room-1',
        limit: 50,
        before: 20000 * 1000,
      });
      expect(result.success).toBe(true);
      expect(result.hasMore).toBe(false);
      expect(result.messages).toHaveLength(10);
      // 오래된 순으로 정렬되었는지 검증 (1번부터 10번 순서)
      expect(result.messages?.[0].messageId).toBe('msg-1');
      expect(result.messages?.[9].messageId).toBe('msg-10');
      expect(result.messages?.[0].createdAt).toBe(1000);
      expect(result.messages?.[9].createdAt).toBe(10000);
    });

    it('수용 기준 4: 방에 총 메시지가 5건인 경우 hasMore가 false로 반환되어야 한다', async () => {
      const mockSocket: Partial<Socket> = {
        id: 'socket-fetch-12',
        rooms: new Set(['room-1']),
      };

      const mock5Messages = Array.from({ length: 5 }, (_, i) => ({
        messageId: `msg-${5 - i}`,
        senderUuid: `user-${5 - i}`,
        content: `메시지 ${5 - i}`,
        createdAt: (5 - i) * 1000,
        senderNickname: `유저${5 - i}`,
      }));

      mockChatServiceClient.getMessages.mockReturnValue(
        of({ messages: mock5Messages }),
      );

      const result = await gateway.handleFetchHistory(mockSocket as Socket, {
        roomId: 'room-1',
        before: 10000,
        limit: 20,
      });

      expect(result.success).toBe(true);
      expect(result.hasMore).toBe(false);
      expect(result.messages).toHaveLength(5);
    });
  });
});
