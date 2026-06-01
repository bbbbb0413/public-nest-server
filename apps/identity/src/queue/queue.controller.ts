import { Body, Controller, Post } from '@nestjs/common';
import { ApiResponseEntity } from '@libs/common/decorator/api-response-entity';
import { ResponseEntity } from '@libs/common/network/response-entity';
import { QueueService } from './queue.service';
import { AddQueueInDto } from './dto/add-queue-in.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('queue')
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('add')
  @ApiResponseEntity({
    summary: 'add queue',
  })
  async addQueue(
    @Body() addQueueInDto: AddQueueInDto,
  ): Promise<ResponseEntity<any>> {
    const result = await this.queueService.addQueue(addQueueInDto);
    return ResponseEntity.ok().body(result);
  }
}
