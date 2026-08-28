import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ConversationTurnDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsString()
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class AskJobInDto {
  @ApiProperty({ description: '질문 내용' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({
    description: '동일 요청 중복 제출 방지를 위한 멱등키 (선택)',
    required: false,
  })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @ApiProperty({ description: '검색할 청크 수', default: 5, required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(20)
  topK?: number;

  @ApiProperty({ description: 'HyDE 활성화 여부', required: false })
  @IsBoolean()
  @IsOptional()
  useHyde?: boolean;

  @ApiProperty({ description: '기존 세션 ID (대화 이어하기)', required: false })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiProperty({
    description: '대화 히스토리 (멀티턴)',
    type: [ConversationTurnDto],
    required: false,
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ConversationTurnDto)
  conversationHistory?: ConversationTurnDto[];
}
