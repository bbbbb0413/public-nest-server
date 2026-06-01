import { Injectable, Logger } from '@nestjs/common';
import { GroqProvider } from '@libs/common/provider/groq.provider';
import { ChatCompletionCreateParamsNonStreaming } from 'groq-sdk/src/resources/chat/completions';
import { GroqCompletionInDto } from './dto/groq-completion-in.dto';
import { EmbeddingCreateParams } from 'groq-sdk/src/resources/embeddings';

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);

  constructor(private readonly groqProvider: GroqProvider) {}

  async getGroqCompletion(
    chatCompletionInDto: GroqCompletionInDto,
  ): Promise<any> {
    const body: ChatCompletionCreateParamsNonStreaming =
      {} as ChatCompletionCreateParamsNonStreaming;
    const content = chatCompletionInDto.content;

    body.messages = [
      {
        role: 'user',
        content: content,
      },
    ];
    body.model = 'llama3-70b-8192';
    body.response_format = { type: 'text' };
    this.logger.debug(JSON.stringify(body));

    const chatCompletion = await this.groqProvider.getGroqChatCompletion(body);

    return chatCompletion;
  }

  async embedding(chatCompletionInDto: GroqCompletionInDto): Promise<any> {
    const body: EmbeddingCreateParams = {} as EmbeddingCreateParams;

    body.input = chatCompletionInDto.content;

    this.logger.debug(JSON.stringify(body));

    const embeddingResponse = await this.groqProvider.embedding(body);
    this.logger.debug(
      JSON.stringify(embeddingResponse.data[0]?.embedding ?? []),
    );

    return embeddingResponse.data;
  }
}
