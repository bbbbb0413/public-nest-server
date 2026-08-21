/// <reference types="multer" />
import {
  BadRequestException,
  Controller,
  HttpCode,
  Post,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Session } from '@libs/shared-kernel';
import { GatewayAuthGuard } from '../../auth/gateway-auth.guard';
import { AiKafkaProducerService } from '../kafka/ai-kafka-producer.service';
import { JobStoreService } from '../job/job-store.service';
import { JobAcceptedOutDto } from '../job/dto/job-accepted-out.dto';
import { KnowledgeFileStagingService } from './knowledge-file-staging.service';
import { KnowledgeUploadExceptionFilter } from './knowledge-upload-exception.filter';

interface AuthenticatedRequest extends Request {
  session: Session;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['text/plain', 'application/pdf', 'text/markdown'];

@ApiTags('ai')
@ApiBearerAuth('jwt')
@UseGuards(GatewayAuthGuard)
@UseFilters(KnowledgeUploadExceptionFilter)
@Controller('ai/knowledge/jobs')
export class KnowledgeJobController {
  constructor(
    private readonly jobStore: JobStoreService,
    private readonly fileStaging: KnowledgeFileStagingService,
    private readonly producer: AiKafkaProducerService,
  ) {}

  @Post()
  @HttpCode(202)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: '문서 업로드 잡 발행 (Kafka 비동기 인제스트, 결과는 SSE로 수신)',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              '지원하지 않는 파일 형식입니다. (TXT, PDF, MD 파일만 지원)',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async createIngestJob(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<JobAcceptedOutDto> {
    if (!file) {
      throw new BadRequestException('업로드할 파일이 누락되었습니다.');
    }

    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const userId = req.session.uuid;
    const job = await this.jobStore.createJob(userId, 'knowledge.ingest');

    await this.fileStaging.stage(job.jobId, file.buffer);
    await this.producer.publishKnowledgeIngestRequested({
      jobId: job.jobId,
      fileName,
      mimeType: file.mimetype,
    });

    return { jobId: job.jobId };
  }
}
