import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessageService } from '../src/message/message.service';
import { IChatMessageStore } from '../src/message/domain/port/chat-message-store.port';
import { CHAT_SOCKET_NOTIFY } from '../src/message/message.constants';

describe('MessageService', () => {
  let service: MessageService;
  let mockStore: any;
  let mockEventEmitter: any;

  beforeEach(async () => {
    mockStore = {
      addMessage: jest.fn().mockResolvedValue(undefined),
      getMessagesSince: jest.fn().mockResolvedValue([]),
      getMessagesBefore: jest.fn().mockResolvedValue([]),
      trimMessages: jest.fn().mockResolvedValue(undefined),
    };
    mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        { provide: IChatMessageStore, useValue: mockStore },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: 'CHAT_CONFIG', useValue: { maxMessagesPerRoom: 500 } },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
  });

  it('메시지를 저장하고 알림을 발행해야 한다 (persistAndNotify)', async () => {
    const roomId = 'lobby';
    const message = Buffer.from('flatbuffer-data');
    const timestamp = Date.now() * 1000;

    await service.persistAndNotify(roomId, message, timestamp, 'socket');

    expect(mockStore.addMessage).toHaveBeenCalledWith(
      roomId,
      message,
      timestamp,
    );
    expect(mockStore.trimMessages).toHaveBeenCalledWith(roomId, 500);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(CHAT_SOCKET_NOTIFY, {
      roomId,
    });
  });

  it('since 이후의 메시지들을 조회해야 한다 (getEventsSince)', async () => {
    const roomId = 'lobby';
    mockStore.getMessagesSince.mockResolvedValue([
      Buffer.from('m1'),
      Buffer.from('m2'),
    ]);

    const result = await service.getEventsSince(roomId, 100, 200);

    expect(mockStore.getMessagesSince).toHaveBeenCalledWith(roomId, 100, 200);
    expect(result).toHaveLength(2);
  });
});
