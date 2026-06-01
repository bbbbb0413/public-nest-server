import { ApiProperty } from '@nestjs/swagger';

export class GroqCompletionInDto {
  @ApiProperty()
  content: string;
}
