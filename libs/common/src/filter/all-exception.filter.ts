import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ServerErrorException } from '../exception/server-error.exception';
import { ResponseEntity } from '@libs/common/network/response-entity';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  logger: Logger;

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {
    this.logger = new Logger('HTTP EXCEPTION');
  }

  catch(exception: any, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const error =
      exception instanceof HttpException || exception?.response
        ? exception?.response
        : undefined;

    const message = error
      ? ServerErrorException.errorCodeToString(error)
      : undefined;

    const responseBody = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      error: error,
      message: message,
    };

    if (
      responseBody.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR &&
      typeof error === 'number'
    ) {
      // response
      const body = ResponseEntity.error(
        responseBody.error,
        responseBody.message,
      );
      httpAdapter.reply(ctx.getResponse(), body, HttpStatus.OK);
    } else {
      httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
    }

    // logging
    const request = {
      method: responseBody.path,
      headers: ctx.getRequest()['headers'],
      body: ctx.getRequest()['body'],
    };

    const errorMessage = {
      request: request,
      ...exception,
    };

    this.logger.error(errorMessage, exception.stack);
  }
}
