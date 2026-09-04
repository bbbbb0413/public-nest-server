import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SaveMyPromptInDto {
  @ApiProperty({ description: '내 시스템 프롬프트 본문' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ description: '저장 후 즉시 활성화 여부', required: false, default: true })
  @IsOptional()
  @IsBoolean()
  activate?: boolean;
}

