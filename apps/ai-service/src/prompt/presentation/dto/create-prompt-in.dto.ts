import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreatePromptInDto {
  @ApiProperty({
    description: '프롬프트 이름 (소문자·숫자·하이픈)',
    example: 'rag-qa-system',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: '이름은 소문자, 숫자, 하이픈만 허용됩니다.',
  })
  name: string;

  @ApiProperty({
    description: '프롬프트 본문. {{context}} 같은 변수 사용 가능',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: '치환 변수 목록',
    example: ['context'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  variables: string[];

  @ApiProperty({
    description: '사용자별 프롬프트일 경우 해당 userId',
    example: 'user-123',
    required: false,
  })
  @IsString()
  @IsOptional()
  userId?: string;
}
