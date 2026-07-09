import { ApiProperty } from '@nestjs/swagger';
import { PromptTemplate } from '../../domain/model/prompt-template';

export class PromptOutDto {
  @ApiProperty() id: string | undefined;
  @ApiProperty() name: string;
  @ApiProperty() version: number;
  @ApiProperty() content: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ type: [String] }) variables: string[];
  @ApiProperty({ required: false }) userId?: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromDomain(template: PromptTemplate): PromptOutDto {
    const dto = new PromptOutDto();
    dto.id = template.id;
    dto.name = template.name.getValue();
    dto.version = template.version;
    dto.content = template.content;
    dto.isActive = template.isActive;
    dto.variables = template.variables;
    dto.userId = template.userId;
    dto.createdAt = template.createdAt;
    dto.updatedAt = template.updatedAt;
    return dto;
  }
}
