import { Body, Controller, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AskUseCase } from '../application/ask.use-case';
import { AskCommand } from '../application/ask.command';
import { AskInDto } from './dto/ask-in.dto';

@ApiTags('qa')
@Controller('qa')
export class QaController {
  constructor(private readonly askUseCase: AskUseCase) {}

  @Post('ask')
  @ApiOperation({ summary: 'RAG 기반 질문 답변 (SSE 스트리밍)' })
  async ask(@Body() dto: AskInDto, @Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const stream = this.askUseCase.execute(
        new AskCommand(dto.question, dto.topK),
      );
      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
    } finally {
      res.end();
    }
  }
}
