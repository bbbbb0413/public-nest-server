import { Body, Controller, Post } from '@nestjs/common';
import { GroqService } from './groq.service';
import { ResponseEntity } from '@libs/common/network/response-entity';
import { ApiResponseEntity } from '@libs/common/decorator/api-response-entity';
import { ApiTags } from '@nestjs/swagger';
import { GroqCompletionInDto } from './dto/groq-completion-in.dto';

@ApiTags('chat')
@Controller('chat')
export class GroqController {
  constructor(private readonly groqService: GroqService) {}

  @Post('completion')
  @ApiResponseEntity({
    summary: 'chat completion',
  })
  async getChatCompletion(
    @Body() chatCompletionInDto: GroqCompletionInDto,
  ): Promise<ResponseEntity<any>> {
    const result = await this.groqService.getGroqCompletion(
      chatCompletionInDto,
    );
    return ResponseEntity.ok().body(result);
  }

  @Post('embedding')
  @ApiResponseEntity({
    summary: 'embedding',
  })
  async getEmbedding(
    @Body() chatCompletionInDto: GroqCompletionInDto,
  ): Promise<ResponseEntity<any>> {
    const result = await this.groqService.embedding(chatCompletionInDto);
    return ResponseEntity.ok().body(result);
  }
}
