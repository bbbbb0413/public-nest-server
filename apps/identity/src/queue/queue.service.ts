import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { AddQueueInDto } from './dto/add-queue-in.dto';

@Injectable()
export class QueueService {
  constructor(@InjectQueue('test') private readonly queue: Queue) {}

  async addQueue(addQueueInDto: AddQueueInDto) {
    const job = await this.queue.add('test', {
      name: addQueueInDto.name,
    });

    return job;
  }
}
