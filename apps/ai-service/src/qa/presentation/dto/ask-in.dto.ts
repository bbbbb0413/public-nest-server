import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class AskInDto {
  @ApiProperty({ description: '질문 내용' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ description: '검색할 청크 수', default: 5, required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  topK?: number;
}
