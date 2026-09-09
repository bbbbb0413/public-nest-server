import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class ToggleBookmarkInDto {
  @ApiPropertyOptional({ description: '북마크 여부 (생략 시 토글)', example: true })
  @IsOptional()
  @IsBoolean()
  bookmarked?: boolean;
}
