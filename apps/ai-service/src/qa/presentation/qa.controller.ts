import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { ConversationSession } from '../domain/model/conversation-session';
import {
  IConversationSessionRepository,
  ConversationSessionRepository,
} from '../domain/repository/conversation-session.repository';
import { AskUseCase } from '../application/ask.use-case';
import { AskCommand } from '../application/ask.command';
import { AgenticAskUseCase } from '../application/agentic-ask.use-case';
import { AgenticAskCommand } from '../application/command/agentic-ask.command';
import { QueryComplexityRouter } from '../application/query-complexity-router';
import { IterationBudget } from '../domain/vo/iteration-budget.vo';
import { GetSessionsUseCase } from '../application/get-sessions.use-case';
import { GetSessionUseCase } from '../application/get-session.use-case';
import { DeleteSessionUseCase } from '../application/delete-session.use-case';
import { AskInDto } from './dto/ask-in.dto';
import { SessionOutDto, SessionDetailOutDto } from './dto/session-out.dto';
import { PromptInjectionGuard } from './guard/prompt-injection.guard';
import { SecretPiiScanner } from '../application/filter/secret-pii-scanner';

const DEFAULT_MAX_ITERATIONS = 2;
const DEFAULT_TOKEN_BUDGET = 30000;
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

@ApiTags('qa')
@Controller('qa')
export class QaController {
  private readonly budget: IterationBudget;
  private readonly confidenceThreshold: number;

  constructor(
    private readonly askUseCase: AskUseCase,
    private readonly agenticAskUseCase: AgenticAskUseCase,
    private readonly queryComplexityRouter: QueryComplexityRouter,
    private readonly secretPiiScanner: SecretPiiScanner,
    private readonly configService: ConfigService,
    private readonly getSessionsUseCase: GetSessionsUseCase,
    private readonly getSessionUseCase: GetSessionUseCase,
    private readonly deleteSessionUseCase: DeleteSessionUseCase,
    @Inject(ConversationSessionRepository)
    private readonly sessionRepo: IConversationSessionRepository,
  ) {
    this.budget = IterationBudget.of(
      this.parseNum('AGENTIC_MAX_ITERATIONS', DEFAULT_MAX_ITERATIONS),
      this.parseNum('AGENTIC_TOKEN_BUDGET', DEFAULT_TOKEN_BUDGET),
      this.parseNum('AGENTIC_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
    );
    this.confidenceThreshold = this.parseNum(
      'AGENTIC_CONFIDENCE_THRESHOLD',
      DEFAULT_CONFIDENCE_THRESHOLD,
    );
  }

  @Get('sessions')
  @ApiOperation({ summary: '유저 대화 세션 목록 조회' })
  async getSessions(
    @Query('userId') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ): Promise<SessionOutDto[]> {
    const sessions = await this.getSessionsUseCase.execute(
      userId,
      Number(page),
      Number(limit),
    );
    return sessions.map((s) => SessionOutDto.fromDomain(s));
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: '대화 세션 상세 조회' })
  async getSession(
    @Param('sessionId') sessionId: string,
  ): Promise<SessionDetailOutDto | null> {
    const session = await this.getSessionUseCase.execute(sessionId);
    if (!session) return null;
    return SessionDetailOutDto.fromDomain(session);
  }

  @Delete('sessions/:sessionId')
  @HttpCode(204)
  @ApiOperation({ summary: '대화 세션 삭제' })
  async deleteSession(@Param('sessionId') sessionId: string): Promise<void> {
    await this.deleteSessionUseCase.execute(sessionId);
  }

  @Post('ask')
  @UseGuards(PromptInjectionGuard)
  @ApiOperation({ summary: 'RAG 기반 질문 답변 (SSE 스트리밍)' })
  async ask(@Body() dto: AskInDto, @Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let session: ConversationSession | null = null;

    if (dto.sessionId) {
      session = await this.sessionRepo.findById(dto.sessionId);
    } else if (dto.userId) {
      session = ConversationSession.create(dto.userId, dto.question);
      session = await this.sessionRepo.persist(session);
    }

    if (session) {
      res.setHeader('X-Session-Id', session.getSessionId());
    }

    try {
      const complexity = this.queryComplexityRouter.route(dto.question);
      const useHyde = dto.useHyde ?? this.shouldUseHyde(dto.question);
      const stream =
        complexity === 'complex'
          ? this.agenticAskUseCase.execute(
              new AgenticAskCommand(
                dto.question,
                dto.topK,
                undefined,
                this.budget,
                this.confidenceThreshold,
                dto.userId,
                dto.conversationHistory,
                useHyde,
              ),
            )
          : this.askUseCase.execute(
              new AskCommand(
                dto.question,
                dto.topK,
                undefined,
                useHyde,
                dto.userId,
                dto.conversationHistory,
                session?.getSessionId(),
              ),
            );

      const collected: string[] = [];
      for await (const chunk of stream) {
        if (chunk.startsWith('__SOURCES:')) {
          const sources: unknown = JSON.parse(chunk.slice(10));
          res.write(
            `data: ${JSON.stringify({ type: 'sources', sources })}\n\n`,
          );
        } else {
          const safe = this.secretPiiScanner.mask(chunk);
          collected.push(safe);
          res.write(`data: ${JSON.stringify({ text: safe })}\n\n`);
        }
      }

      if (session && collected.length > 0) {
        const fullResponse = collected.join('');
        const updated = session.appendTurn(dto.question, fullResponse);
        await this.sessionRepo.update(updated);
      }

      res.write('data: [DONE]\n\n');
    } finally {
      res.end();
    }
  }

  private shouldUseHyde(question: string): boolean {
    const maxWords = this.parseNum('HYDE_MAX_QUERY_WORDS', 5);
    return question.trim().split(/\s+/).filter(Boolean).length <= maxWords;
  }

  private parseNum(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    if (raw === undefined) return fallback;
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
}
