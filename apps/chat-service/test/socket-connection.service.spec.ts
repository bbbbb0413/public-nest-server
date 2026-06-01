import { Test, TestingModule } from '@nestjs/testing';
import { SocketConnectionService } from '../src/socket/socket-connection.service';
import { IPubSubPort } from '../src/message/domain/port/pub-sub.port';
import { MessageService } from '../src/message/message.service';

describe('SocketConnectionService', () => {
  let service: SocketConnectionService;
  let mockPubSubService: any;
  let mockMessageService: any;
  let mockIoServer: any;

  beforeEach(async () => {
    mockPubSubService = {
      publish: jest.fn(),
      subscribeAll: jest.fn(),
      onMessage: jest.fn(),
      unsubscribeAll: jest.fn(),
    };
    mockMessageService = {
      getEventsSince: jest.fn(),
    };
    mockIoServer = {
      adapter: { rooms: new Map() },
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocketConnectionService,
        { provide: IPubSubPort, useValue: mockPubSubService },
        { provide: MessageService, useValue: mockMessageService },
      ],
    }).compile();

    service = module.get<SocketConnectionService>(SocketConnectionService);
    service.setServer(mockIoServer);
  });

  it('알림 수신 시 로컬에 방이 있으면 메시지를 pull하고 emit해야 한다', async () => {
    const roomId = 'lobby';
    mockIoServer.adapter.rooms.set(roomId, new Set(['socket-id']));
    service['roomLastFlushed'].set(roomId, 100);

    mockMessageService.getEventsSince.mockResolvedValue([Buffer.from('msg1')]);

    await service['onShardMessage'](roomId);

    expect(mockMessageService.getEventsSince).toHaveBeenCalledWith(
      roomId,
      100,
      200,
    );
    expect(mockIoServer.to).toHaveBeenCalledWith(roomId);
    expect(mockIoServer.emit).toHaveBeenCalledWith(
      'new_messages',
      roomId,
      expect.any(Buffer),
    );
  });

  it('로컬에 방이 없으면 무시해야 한다', async () => {
    await service['onShardMessage']('empty-room');
    expect(mockMessageService.getEventsSince).not.toHaveBeenCalled();
  });
});
