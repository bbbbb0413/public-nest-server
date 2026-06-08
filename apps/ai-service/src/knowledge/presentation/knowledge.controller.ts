import {
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IngestDocumentUseCase } from '../application/ingest-document.use-case';
import {
  IDocumentRepository,
  DocumentRepository,
} from '../domain/repository/document.repository';
import {
  IVectorStorePort,
  VectorStorePort,
} from '../domain/port/vector-store.port';
import { DocumentOutDto } from './dto/document-out.dto';

@ApiTags('knowledge')
@Controller('knowledge/documents')
export class KnowledgeController {
  constructor(
    private readonly ingestUseCase: IngestDocumentUseCase,
    @Inject(DocumentRepository)
    private readonly documentRepo: IDocumentRepository,
    @Inject(VectorStorePort) private readonly vectorStore: IVectorStorePort,
  ) {}

  @Post()
  @ApiOperation({ summary: '문서 업로드 및 수집' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<DocumentOutDto> {
    const document = await this.ingestUseCase.execute({
      fileName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });
    return DocumentOutDto.fromDomain(document);
  }

  @Get()
  @ApiOperation({ summary: '문서 목록 조회' })
  async list(): Promise<DocumentOutDto[]> {
    const documents = await this.documentRepo.findAll();
    return documents.map(DocumentOutDto.fromDomain);
  }

  @Delete(':id')
  @ApiOperation({ summary: '문서 삭제' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.vectorStore.deleteByDocumentId(id);
    await this.documentRepo.remove(id);
  }
}
