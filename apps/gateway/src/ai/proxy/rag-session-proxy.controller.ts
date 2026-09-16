import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Session } from '@libs/shared-kernel';
import { GatewayAuthGuard } from '../../auth/gateway-auth.guard';
import { AiServicePyHttpService } from './ai-service-py-http.service';
import { SaveBookmarkInDto } from './dto/save-bookmark-in.dto';
import { ToggleBookmarkInDto } from './dto/toggle-bookmark-in.dto';

interface AuthenticatedRequest extends Request {
  session: Session;
}

@ApiTags('ai')
@ApiBearerAuth('jwt')
@UseGuards(GatewayAuthGuard)
@Controller('ai/rag')
export class RagSessionProxyController {
  constructor(private readonly aiServicePy: AiServicePyHttpService) {}

  @Get('sessions')
  @ApiOperation({ summary: '유저 대화 세션 목록 및 검색 결과 조회 (ai-service-py 프록시)' })
  async getSessions(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('search') search?: string,
    @Query('bookmarked') bookmarked?: string,
    @Query('keyword') keyword?: string,
  ): Promise<unknown> {
    const query = q ?? search;
    const params: Record<string, string> = { userId: req.session.uuid };
    if (page !== undefined) params.page = page;
    if (limit !== undefined) params.limit = limit;
    if (query !== undefined) params.q = query;
    if (bookmarked !== undefined) params.bookmarked = bookmarked;
    if (keyword !== undefined) params.keyword = keyword;

    return this.aiServicePy.get({
      method: 'rag/sessions',
      params,
    });
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: '대화 세션 상세 조회 — 본인 세션만 (ai-service-py 프록시)' })
  async getSession(
    @Req() req: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
  ): Promise<unknown> {
    return this.aiServicePy.get({
      method: `rag/sessions/${sessionId}`,
      params: { userId: req.session.uuid },
    });
  }

  @Patch('sessions/:sessionId/bookmark')
  @ApiOperation({ summary: '대화 세션 북마크 상태 변경 (ai-service-py 프록시)' })
  async updateSessionBookmark(
    @Req() req: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() dto?: ToggleBookmarkInDto,
  ): Promise<unknown> {
    return this.aiServicePy.patch({
      method: `rag/sessions/${sessionId}/bookmark`,
      data: dto,
      params: { userId: req.session.uuid },
    });
  }

  @Post('sessions/:sessionId/bookmark')
  @ApiOperation({ summary: '대화 세션 북마크 등록 (ai-service-py 프록시)' })
  async bookmarkSession(
    @Req() req: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() dto?: ToggleBookmarkInDto,
  ): Promise<unknown> {
    return this.aiServicePy.post({
      method: `rag/sessions/${sessionId}/bookmark`,
      ...(dto && Object.keys(dto).length > 0 ? { data: dto } : {}),
      params: { userId: req.session.uuid },
    });
  }

  @Delete('sessions/:sessionId/bookmark')
  @HttpCode(204)
  @ApiOperation({ summary: '대화 세션 북마크 해제 (ai-service-py 프록시)' })
  async unbookmarkSession(
    @Req() req: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    await this.aiServicePy.delete({
      method: `rag/sessions/${sessionId}/bookmark`,
      params: { userId: req.session.uuid },
    });
  }

  @Delete('sessions/:sessionId')
  @HttpCode(204)
  @ApiOperation({ summary: '대화 세션 삭제 — 본인 세션만 (ai-service-py 프록시)' })
  async deleteSession(
    @Req() req: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    await this.aiServicePy.delete({
      method: `rag/sessions/${sessionId}`,
      params: { userId: req.session.uuid },
    });
  }

  @Get('bookmarks')
  @ApiOperation({ summary: '보관(북마크) 목록 조회 (ai-service-py 프록시)' })
  async getBookmarks(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('search') search?: string,
  ): Promise<unknown> {
    const query = q ?? search;
    const params: Record<string, string> = { userId: req.session.uuid };
    if (page !== undefined) params.page = page;
    if (limit !== undefined) params.limit = limit;
    if (query !== undefined) params.q = query;

    return this.aiServicePy.get({
      method: 'rag/bookmarks',
      params,
    });
  }

  @Post('bookmarks')
  @ApiOperation({ summary: '답변 또는 세션 보관(북마크) 등록 (ai-service-py 프록시)' })
  async createBookmark(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SaveBookmarkInDto,
  ): Promise<unknown> {
    return this.aiServicePy.post({
      method: 'rag/bookmarks',
      data: dto,
      params: { userId: req.session.uuid },
    });
  }

  @Delete('bookmarks/:bookmarkId')
  @HttpCode(204)
  @ApiOperation({ summary: '보관(북마크) 항목 삭제 (ai-service-py 프록시)' })
  async deleteBookmark(
    @Req() req: AuthenticatedRequest,
    @Param('bookmarkId') bookmarkId: string,
  ): Promise<void> {
    await this.aiServicePy.delete({
      method: `rag/bookmarks/${bookmarkId}`,
      params: { userId: req.session.uuid },
    });
  }
}
