export class IngestDocumentCommand {
  constructor(
    readonly fileName: string,
    readonly mimeType: string,
    readonly buffer: Buffer,
  ) {}
}
