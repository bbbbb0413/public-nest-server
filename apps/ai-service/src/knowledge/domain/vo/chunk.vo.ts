import { ValueObject } from '@libs/shared-kernel';

interface ChunkValue {
  text: string;
  index: number;
  documentId: string;
  charCount?: number;
  parentChunkId?: string;
}

export class Chunk extends ValueObject<ChunkValue> {
  protected validate(value: ChunkValue): void {
    if (!value.text || value.text.trim().length === 0)
      throw new Error('청크 텍스트는 비어있을 수 없습니다.');
    if (value.index < 0) throw new Error('청크 인덱스는 0 이상이어야 합니다.');
  }

  static of(
    text: string,
    index: number,
    documentId: string,
    opts?: { charCount?: number; parentChunkId?: string },
  ): Chunk {
    return new Chunk({ text, index, documentId, ...opts });
  }

  getText(): string {
    return this.getValue().text;
  }
  getIndex(): number {
    return this.getValue().index;
  }
  getDocumentId(): string {
    return this.getValue().documentId;
  }
  getCharCount(): number | undefined {
    return this.getValue().charCount;
  }
  getParentChunkId(): string | undefined {
    return this.getValue().parentChunkId;
  }
}
