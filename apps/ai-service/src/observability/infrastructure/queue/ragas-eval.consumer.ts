import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { RagasEvalService } from '../../application/ragas-eval.service';
import { RagasEvalPayload } from '../../application/ragas-eval.payload';

@Processor('ragas-eval')
export class RagasEvalConsumer {
  private readonly logger = new Logger(RagasEvalConsumer.name);

  constructor(private readonly ragasEvalService: RagasEvalService) {}

  @Process()
  async process(job: Job<RagasEvalPayload>): Promise<void> {
    this.logger.debug(`Processing ragas-eval job ${job.id}`);
    await this.ragasEvalService.evaluate(job.data);
  }
}
