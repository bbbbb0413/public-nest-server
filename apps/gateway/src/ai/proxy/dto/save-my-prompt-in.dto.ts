import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SaveMyPromptInDto {
  @ApiProperty({ description: '내 시스템 프롬프트 본문' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
