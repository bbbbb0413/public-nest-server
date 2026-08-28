import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsNotEmpty,
} from 'class-validator';

// ai-service-py 의 RATING_MIN/RATING_MAX 와 같아야 한다.
const RATING_MIN = 1;
const RATING_MAX = 5;
const MAX_COMMENT_LENGTH = 1000;

export class SubmitAnswerFeedbackInDto {
  @ApiProperty({ description: '평가 대상 답변이 속한 대화 세션 식별자' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({
    description:
      '세션 안에서 평가 대상 답변이 놓인 턴 위치. 턴은 덧붙이기만 하므로 위치가 밀리지 않는다.',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  turnIndex: number;

  @ApiProperty({ description: '정확도', minimum: RATING_MIN, maximum: RATING_MAX })
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  accuracy: number;

  @ApiProperty({ description: '유용성', minimum: RATING_MIN, maximum: RATING_MAX })
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  helpfulness: number;

  @ApiPropertyOptional({ description: '자유 의견', maxLength: MAX_COMMENT_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_COMMENT_LENGTH)
  comment?: string;
}
