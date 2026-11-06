import { ChatGrpcMapper } from '../src/message/rpc/chat.grpc-mapper';
import { SaveMessageRequest } from '@libs/rpc';
import * as flatbuffers from 'flatbuffers';
import * as Chat from '../src/flatbuffers/generated/chat';
import { buildChatMessage } from '../src/flatbuffers/builders';

describe('ChatGrpcMapper', () => {
  describe('toMessageBuffer', () => {
    it('전달받은 senderNickname을 FlatBuffers metadata 필드에 직렬화하여 저장해야 한다', () => {
      const request: SaveMessageRequest = {
        roomId: 'room-1',
        senderUuid: 'uuid-1',
        content: '안녕하세요',
        senderNickname: '플레이어A',
      };
      const messageId = 'msg-1';
      const timestamp = 1700000000000;
      const eventTimestamp = 1700000000000000;

      const buffer = ChatGrpcMapper.toMessageBuffer(
        request,
        messageId,
        timestamp,
        eventTimestamp,
      );

      const bb = new flatbuffers.ByteBuffer(new Uint8Array(buffer));
      const chatMsg = Chat.ChatMessage.getRootAsChatMessage(bb);

      expect(chatMsg.id()).toBe(messageId);
      expect(chatMsg.senderId()).toBe('uuid-1');
      expect(chatMsg.content()).toBe('안녕하세요');
      expect(chatMsg.metadata()).toBe('플레이어A');
      expect(Number(chatMsg.timestamp())).toBe(timestamp);
      expect(Number(chatMsg.eventTimestamp())).toBe(eventTimestamp);
    });

    it('senderNickname이 없는 경우 metadata 필드에 빈 문자열을 저장해야 한다', () => {
      const request: SaveMessageRequest = {
        roomId: 'room-1',
        senderUuid: 'uuid-1',
        content: '안녕하세요',
      };
      const messageId = 'msg-2';
      const timestamp = 1700000000000;
      const eventTimestamp = 1700000000000000;

      const buffer = ChatGrpcMapper.toMessageBuffer(
        request,
        messageId,
        timestamp,
        eventTimestamp,
      );

      const bb = new flatbuffers.ByteBuffer(new Uint8Array(buffer));
      const chatMsg = Chat.ChatMessage.getRootAsChatMessage(bb);

      expect(chatMsg.metadata()).toBe('');
    });
  });

  describe('toGetMessagesResponse', () => {
    it('FlatBuffers 메시지의 metadata를 gRPC ChatMessage.senderNickname으로 복원해야 한다', () => {
      const timestamp = 1700000000000;
      const eventTimestamp = 1700000000000000;
      const uint8Array = buildChatMessage(
        'msg-3',
        Chat.MessageStatus.NORMAL,
        'uuid-2',
        '반갑습니다',
        '플레이어B',
        timestamp,
        eventTimestamp,
      );
      const buffer = Buffer.from(uint8Array);

      const response = ChatGrpcMapper.toGetMessagesResponse([buffer]);

      expect(response.messages).toHaveLength(1);
      expect(response.messages[0]).toEqual({
        messageId: 'msg-3',
        senderUuid: 'uuid-2',
        content: '반갑습니다',
        createdAt: timestamp,
        senderNickname: '플레이어B',
      });
    });

    it('metadata가 비어있는 레거시 메시지의 경우 senderNickname을 빈 문자열로 복원해야 한다', () => {
      const timestamp = 1700000000000;
      const eventTimestamp = 1700000000000000;
      const uint8Array = buildChatMessage(
        'msg-legacy',
        Chat.MessageStatus.NORMAL,
        'uuid-legacy',
        '레거시 메시지',
        '',
        timestamp,
        eventTimestamp,
      );
      const buffer = Buffer.from(uint8Array);

      const response = ChatGrpcMapper.toGetMessagesResponse([buffer]);

      expect(response.messages).toHaveLength(1);
      expect(response.messages[0].senderNickname).toBe('');
    });
  });
});
