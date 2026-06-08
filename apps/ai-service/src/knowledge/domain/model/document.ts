import { AggregateRoot } from '@libs/shared-kernel';

export type DocumentStatus = 'pending' | 'processed' | 'failed';

export interface DocumentProps {
  id?: string;
  fileName: string;
  mimeType: string;
  status: DocumentStatus;
  chunkCount: number;
  createdAt?: Date;
}

export class Document extends AggregateRoot {
  private constructor(
    readonly id: string | undefined,
    readonly fileName: string,
    readonly mimeType: string,
    readonly status: DocumentStatus,
    readonly chunkCount: number,
    readonly createdAt: Date,
  ) {
    super();
  }

  static create(props: { fileName: string; mimeType: string }): Document {
    return new Document(
      undefined,
      props.fileName,
      props.mimeType,
      'pending',
      0,
      new Date(),
    );
  }

  static restore(props: DocumentProps): Document {
    return new Document(
      props.id,
      props.fileName,
      props.mimeType,
      props.status,
      props.chunkCount,
      props.createdAt ?? new Date(),
    );
  }

  markProcessed(chunkCount: number): Document {
    return Document.restore({
      id: this.id,
      fileName: this.fileName,
      mimeType: this.mimeType,
      status: 'processed',
      chunkCount,
      createdAt: this.createdAt,
    });
  }

  markFailed(): Document {
    return Document.restore({
      id: this.id,
      fileName: this.fileName,
      mimeType: this.mimeType,
      status: 'failed',
      chunkCount: 0,
      createdAt: this.createdAt,
    });
  }
}
