import { ApiProperty } from '@nestjs/swagger';
import { Document } from '../../domain/model/document';

export class DocumentOutDto {
  @ApiProperty() id: string;
  @ApiProperty() fileName: string;
  @ApiProperty() mimeType: string;
  @ApiProperty({ enum: ['pending', 'processed', 'failed'] }) status: string;
  @ApiProperty() chunkCount: number;
  @ApiProperty() createdAt: Date;

  static fromDomain(document: Document): DocumentOutDto {
    const dto = new DocumentOutDto();
    dto.id = document.id;
    dto.fileName = document.fileName;
    dto.mimeType = document.mimeType;
    dto.status = document.status;
    dto.chunkCount = document.chunkCount;
    dto.createdAt = document.createdAt;
    return dto;
  }
}
