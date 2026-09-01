import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class KnowledgeUploadExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '서버 오류가 발생했습니다.';

    // Check if the exception is due to file size limits
    const isMulterLimitError =
      exception.code === 'LIMIT_FILE_SIZE' ||
      exception.message === 'File too large' ||
      (exception instanceof HttpException &&
        (exception.getStatus() === HttpStatus.PAYLOAD_TOO_LARGE ||
          exception.message.includes('File too large') ||
          (typeof exception.getResponse() === 'object' &&
            (exception.getResponse() as any)?.message === 'File too large')));

    if (isMulterLimitError) {
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      message = '파일 크기가 50MB 제한을 초과했습니다.';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resBody = exception.getResponse();
      if (typeof resBody === 'object' && resBody !== null && 'message' in resBody) {
        const bodyMessage = (resBody as any).message;
        message = Array.isArray(bodyMessage) ? bodyMessage[0] : bodyMessage;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.BAD_REQUEST;
      message = exception.message;
    }

    response.status(status).json({
      statusCode: status,
      message: message,
      error: HttpStatus[status] || 'Error',
    });
  }
}
