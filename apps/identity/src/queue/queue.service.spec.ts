import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { getQueueToken } from '@nestjs/bull';
import { createBullQueueMock } from '../../../../test-support/mocks/bull-queue.mock';

describe('QueueService', () => {
  let service: QueueService;
  let queue: ReturnType<typeof createBullQueueMock>;

  beforeEach(async () => {
    queue = createBullQueueMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: getQueueToken('test'),
          useValue: queue,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  it('addQueue를 호출하면 큐에 작업을 추가하고 작업 객체를 반환한다', async () => {
    const result = await service.addQueue({ name: 'test-job', email: 123, password: 456 } as any);
    expect(result).toHaveProperty('id', 'mock-job-id');
    expect(queue.add).toHaveBeenCalledWith('test', { name: 'test-job' });
  });
});
