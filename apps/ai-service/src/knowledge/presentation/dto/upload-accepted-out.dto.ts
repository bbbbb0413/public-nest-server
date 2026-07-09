import { ApiProperty } from '@nestjs/swagger';

export class UploadAcceptedOutDto {
  @ApiProperty() jobId: string;
  @ApiProperty() documentId: string;
  @ApiProperty({ enum: ['pending'] }) status: 'pending';

  static of(jobId: string, documentId: string): UploadAcceptedOutDto {
    const dto = new UploadAcceptedOutDto();
    dto.jobId = jobId;
    dto.documentId = documentId;
    dto.status = 'pending';
    return dto;
  }
}
