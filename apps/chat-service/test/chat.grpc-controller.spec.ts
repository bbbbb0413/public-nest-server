import { Test, TestingModule } from '@nestjs/testing';
import { ChatGrpcController } from '../src/message/rpc/chat.grpc-controller';
import { MessageService } from '../src/message/message.service';
import { Metadata } from '@grpc/grpc-js';
import { SaveMessageRequest, SaveMessageResponse, GetMessagesRequest, GetMessagesResponse } from '@libs/rpc';
import * as flatbuffers from 'flatbuffers';
import { buildChatMessage } from '../src/flatbuffers/builders';

const mockMessageService = () => ({
  persistAndNotify: jest.fn(),
  getHistory: jest.fn(),
});

describe('ChatGrpcController', () => {
  let controller: ChatGrpcController;
  let messageService: ReturnType<typeof mockMessageService>;

  beforeEach(async () => {
    messageService = mockMessageService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatGrpcController],
      providers: [
        { provide: MessageService, useValue: messageService },
      ],
    }).compile();

    controller = module.get<ChatGrpcController>(ChatGrpcController);
  });

  describe('saveMessage', () => {
    it('gRPC 저장 요청을 받아 MessageService를 호출하고 결과를 반환해야 한다', async () => {
      messageService.persistAndNotify.mockResolvedValue(undefined);

      const request: SaveMessageRequest = {
        roomId: 'room-1',
        senderUuid: 'user-1',
        content: 'hello',
      };
      const metadata = new Metadata();

      const reply = (await controller.saveMessage(request, metadata)) as SaveMessageResponse;

      expect(messageService.persistAndNotify).toHaveBeenCalled();
      expect(reply.messageId).toBeDefined();
      expect(reply.createdAt).toBeGreaterThan(0);
    });
  });

  describe('getMessages', () => {
    it('gRPC 히스토리 조회 요청을 받아 결과를 반환해야 한다', async () => {
      const msgBuf = Buffer.from(
        buildChatMessage('msg-1', 1, 'user-1', 'hello', '', Date.now(), Date.now() * 1000)
      );
      messageService.getHistory.mockResolvedValue([msgBuf]);

      const request: GetMessagesRequest = {
        roomId: 'room-1',
        limit: 10,
      };
      const metadata = new Metadata();

      const reply = (await controller.getMessages(request, metadata)) as GetMessagesResponse;

      expect(messageService.getHistory).toHaveBeenCalledWith('room-1', expect.any(Number), 10);
      expect(reply.messages).toHaveLength(1);
      expect(reply.messages[0].messageId).toBe('msg-1');
      expect(reply.messages[0].senderUuid).toBe('user-1');
      expect(reply.messages[0].content).toBe('hello');
    });
  });
});
