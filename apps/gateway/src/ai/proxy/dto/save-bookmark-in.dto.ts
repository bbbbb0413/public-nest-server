import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SaveBookmarkInDto {
  @ApiProperty({ description: '대화 세션 ID', example: 'sess-1' })
  @IsNotEmpty()
  @IsString()
  sessionId: string;

  @ApiPropertyOptional({ description: '대화 턴(메시지) 인덱스', example: 0 })
  @IsOptional()
  @IsNumber()
  turnIndex?: number;

  @ApiPropertyOptional({ description: '북마크 메모/노트', example: '중요한 답변' })
  @IsOptional()
  @IsString()
  note?: string;
}
