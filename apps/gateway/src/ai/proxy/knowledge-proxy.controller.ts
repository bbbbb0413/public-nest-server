import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
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
    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      this.resolveContentDisposition(file.contentDisposition, id),
    );
    res.send(file.data);
  }

  /**
   * Content-Disposition 헤더가 누락되었거나 안전하지 않은 경우 기본 파일명(filename="{id}")을 보완한다.
   */
  private resolveContentDisposition(
    contentDisposition: string | undefined,
    id: string,
  ): string {
    const safeId = id.replace(/["\r\n/\\]/g, '_');
    const defaultDisposition = `inline; filename="${safeId}"`;

    if (!contentDisposition || !contentDisposition.trim()) {
      return defaultDisposition;
    }

    // CRLF 헤더 인젝션 방지
    if (/[\r\n]/.test(contentDisposition)) {
      return defaultDisposition;
    }

    const trimmed = contentDisposition.trim();
    const filenameMatch = trimmed.match(/filename\*?=(?:(?:"([^"]*)")|([^;]+))/i);

    if (!filenameMatch) {
      const dispositionType = trimmed.split(';')[0].trim();
      const safeType =
        dispositionType.toLowerCase() === 'attachment' ? 'attachment' : 'inline';
      return `${safeType}; filename="${safeId}"`;
    }

    const rawFilename = (filenameMatch[1] ?? filenameMatch[2] ?? '').trim();
    const hasControlChar = Array.from(rawFilename).some((ch) => {
      const code = ch.charCodeAt(0);
      return (code >= 0 && code <= 31) || code === 127;
    });

    const isUnsafe =
      rawFilename.length === 0 ||
      rawFilename.includes('..') ||
      rawFilename.includes('/') ||
      rawFilename.includes('\\') ||
      hasControlChar;

    if (isUnsafe) {
      const dispositionType = trimmed.split(';')[0].trim();
      const safeType =
        dispositionType.toLowerCase() === 'attachment' ? 'attachment' : 'inline';
      return `${safeType}; filename="${safeId}"`;
    }

    return trimmed;
  }

  @Post(':id/retry')
  @ApiOperation({ summary: '문서 재인제스트 (ai-service-py 프록시)' })
  async retry(@Param('id') id: string): Promise<unknown> {
    return this.aiServicePy.post({ method: `knowledge/documents/${id}/retry` });
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: '문서 삭제 (ai-service-py 프록시)' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.aiServicePy.delete({ method: `knowledge/documents/${id}` });
  }
}
