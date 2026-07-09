import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';

export const INGEST_QUEUE = 'ingest';
export const INGEST_JOB = 'ingest';

export interface IngestJobPayload {
  documentId: string;
  fileName: string;
  mimeType: string;
  content: string;
}

@Injectable()
export class IngestQueueService {
  constructor(@InjectQueue(INGEST_QUEUE) private readonly queue: Queue) {}

  async enqueue(payload: IngestJobPayload): Promise<Job<IngestJobPayload>> {
    return this.queue.add(INGEST_JOB, payload);
  }
}
