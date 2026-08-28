import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { GatewayAuthGuard } from '../../auth/gateway-auth.guard';
import { AiServicePyHttpService } from './ai-service-py-http.service';

@ApiTags('ai')
@ApiBearerAuth('jwt')
@UseGuards(GatewayAuthGuard)
@Controller('ai/knowledge/documents')
export class KnowledgeProxyController {
  constructor(private readonly aiServicePy: AiServicePyHttpService) {}

  @Get()
  @ApiOperation({ summary: '문서 목록 조회 (ai-service-py 프록시)' })
  async list(): Promise<unknown> {
    return this.aiServicePy.get({ method: 'knowledge/documents' });
  }

  @Get(':id')
  @ApiOperation({ summary: '문서 단건 조회 (ai-service-py 프록시)' })
  async findOne(@Param('id') id: string): Promise<unknown> {
    return this.aiServicePy.get({ method: `knowledge/documents/${id}` });
  }

  @Get(':id/chunks')
  @ApiOperation({ summary: '문서 청크 내용 조회 (ai-service-py 프록시)' })
  async listChunks(@Param('id') id: string): Promise<unknown> {
    return this.aiServicePy.get({ method: `knowledge/documents/${id}/chunks` });
  }

  @Get(':id/file')
  @ApiOperation({ summary: '문서 원본 파일 다운로드 (ai-service-py 프록시)' })
  async getFile(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const file = await this.aiServicePy.getBinary(`knowledge/documents/${id}/file`);
    res.setHeader('Content-Type', file.contentType);
    if (file.contentDisposition) {
      res.setHeader('Content-Disposition', file.contentDisposition);
    }
    res.send(file.data);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: '문서 삭제 (ai-service-py 프록시)' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.aiServicePy.delete({ method: `knowledge/documents/${id}` });
  }
}
