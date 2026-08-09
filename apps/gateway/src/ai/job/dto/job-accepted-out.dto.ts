import { ApiProperty } from '@nestjs/swagger';

export class JobAcceptedOutDto {
  @ApiProperty({ description: '발행된 잡 ID. SSE 구독 시 사용' })
  jobId: string;
}
