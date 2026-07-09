import { Logger } from '@nestjs/common';
import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { IngestDocumentUseCase } from '../../application/ingest-document.use-case';
import {
  INGEST_JOB,
  INGEST_QUEUE,
  IngestJobPayload,
} from '../../application/ingest-queue.service';

@Processor(INGEST_QUEUE)
export class IngestConsumer {
  private readonly logger = new Logger(IngestConsumer.name);

  constructor(private readonly ingestUseCase: IngestDocumentUseCase) {}

  @Process(INGEST_JOB)
  async handle(job: Job<IngestJobPayload>): Promise<void> {
    const { documentId, fileName, mimeType, content } = job.data;
    const buffer = Buffer.from(content, 'base64');
    await this.ingestUseCase.execute({
      documentId,
      fileName,
      mimeType,
      buffer,
    });
  }

  @OnQueueFailed({ name: INGEST_JOB })
  onFailed(job: Job<IngestJobPayload>, err: Error): void {
    this.logger.error(
      `문서 인제스트 실패: ${job.data.fileName} — ${err.message}`,
    );
  }
}
