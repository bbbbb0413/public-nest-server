import { Test, TestingModule } from '@nestjs/testing';
import { ShardedPubSubService } from '../src/pubsub/sharded-pubsub.service';
import { getChatShardChannel } from '../src/infrastructure/redis/chat.keys';

describe('ShardedPubSubService', () => {
  let service: ShardedPubSubService;
  let mockPubClient: any;
  let mockSubClient: any;
  const shardCount = 10;

  beforeEach(async () => {
    mockPubClient = {
      publish: jest.fn().mockResolvedValue(1),
    };
    mockSubClient = {
      subscribe: jest.fn().mockResolvedValue('OK'),
      unsubscribe: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
      off: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShardedPubSubService,
        {
          provide: 'CHAT_REDIS_COMMAND_CLIENT',
          useValue: mockPubClient,
        },
        {
          provide: 'CHAT_REDIS_PUBSUB_CLIENT',
          useValue: mockSubClient,
        },
        {
          provide: 'SHARD_COUNT',
          useValue: shardCount,
        },
      ],
    }).compile();

    service = module.get<ShardedPubSubService>(ShardedPubSubService);
  });

  it('roomId를 기반으로 적절한 샤드 채널에 알림을 발행해야 한다', async () => {
    const roomId = 'lobby';
    const channel = getChatShardChannel(roomId, shardCount);

    await service.publish(roomId);

    expect(mockPubClient.publish).toHaveBeenCalledWith(channel, roomId);
  });

  it('모든 샤드 채널을 구독해야 한다', async () => {
    await service.subscribeAll();

    expect(mockSubClient.subscribe).toHaveBeenCalledTimes(shardCount);
    for (let i = 0; i < shardCount; i++) {
      expect(mockSubClient.subscribe).toHaveBeenCalledWith(
        getChatShardChannel(i),
      );
    }
  });

  it('메시지 수신 시 콜백을 실행해야 한다', () => {
    const callback = jest.fn();
    service.onMessage(callback);

    // subClient.on('message', ...)가 호출되었는지 확인
    expect(mockSubClient.on).toHaveBeenCalledWith(
      'message',
      expect.any(Function),
    );

    // 강제로 메시지 이벤트 발생 시뮬레이션
    const onMessageHandler = mockSubClient.on.mock.calls.find(
      (call) => call[0] === 'message',
    )[1];
    onMessageHandler('chat:ws:shard:0', 'lobby');

    expect(callback).toHaveBeenCalledWith('lobby');
  });
});
