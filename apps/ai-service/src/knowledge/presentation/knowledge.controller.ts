import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminApiKeyGuard } from './guard/admin-api-key.guard';
import {
  IDocumentRepository,
  DocumentRepository,
} from '../domain/repository/document.repository';
import {
  IVectorStorePort,
  VectorStorePort,
} from '../domain/port/vector-store.port';
import { IngestQueueService } from '../application/ingest-queue.service';
import { DocumentOutDto } from './dto/document-out.dto';
import { UploadAcceptedOutDto } from './dto/upload-accepted-out.dto';
import { Document } from '../domain/model/document';

@ApiTags('knowledge')
@UseGuards(AdminApiKeyGuard)
@Controller('knowledge/documents')
export class KnowledgeController {
  constructor(
    private readonly ingestQueue: IngestQueueService,
    @Inject(DocumentRepository)
    private readonly documentRepo: IDocumentRepository,
    @Inject(VectorStorePort) private readonly vectorStore: IVectorStorePort,
  ) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({ summary: '문서 업로드 (비동기 처리)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['text/plain', 'application/pdf', 'text/markdown'];
        cb(null, allowed.includes(file.mimetype));
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadAcceptedOutDto> {
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const document = await this.documentRepo.persist(
      Document.create({ fileName, mimeType: file.mimetype }),
    );

    const job = await this.ingestQueue.enqueue({
      documentId: document.id,
      fileName,
      mimeType: file.mimetype,
      content: file.buffer.toString('base64'),
    });

    return UploadAcceptedOutDto.of(String(job.id), document.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '문서 단건 조회' })
  async findOne(@Param('id') id: string): Promise<DocumentOutDto> {
    const document = await this.documentRepo.findById(id);
    return DocumentOutDto.fromDomain(document);
  }

  @Get()
  @ApiOperation({ summary: '문서 목록 조회' })
  async list(): Promise<DocumentOutDto[]> {
    const documents = await this.documentRepo.findAll();
    return documents.map(DocumentOutDto.fromDomain);
  }

  @Get(':id/chunks')
  @ApiOperation({ summary: '문서 청크 내용 조회 (데이터 검증용)' })
  async listChunks(
    @Param('id') id: string,
  ): Promise<{ chunkIndex: number; text: string }[]> {
    const chunks = await this.vectorStore.findChunksByDocumentId(id);
    return chunks.map((c) => ({
      chunkIndex: c.metadata.chunkIndex,
      text: c.text,
    }));
  }

  @Delete(':id')
  @ApiOperation({ summary: '문서 삭제' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.vectorStore.deleteByDocumentId(id);
    await this.documentRepo.remove(id);
  }
}
