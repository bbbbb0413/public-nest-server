import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePromptInDto {
  @ApiProperty({ description: '프롬프트 이름 (소문자·숫자·하이픈)' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '프롬프트 본문' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ description: '치환 변수 목록', type: [String] })
  @IsArray()
  @IsString({ each: true })
  variables: string[];

  @ApiProperty({
    description: '사용자별 프롬프트일 경우 해당 userId',
    required: false,
  })
  @IsString()
  @IsOptional()
  userId?: string;
}
