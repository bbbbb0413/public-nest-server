import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Response } from 'express';
import { status } from '@grpc/grpc-js';

interface GrpcErrorShape {
  code: number;
  message?: string;
  details?: string;
}

function isGrpcErrorShape(raw: unknown): raw is GrpcErrorShape {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    'code' in raw &&
    typeof (raw as { code: unknown }).code === 'number'
  );
}

function extractGrpcError(exception: unknown): GrpcErrorShape | null {
  if (exception instanceof RpcException) {
    const inner = exception.getError();
    return isGrpcErrorShape(inner) ? inner : null;
  }
  return isGrpcErrorShape(exception) ? exception : null;
}

const GRPC_TO_HTTP_STATUS: Record<number, HttpStatus> = {
  [status.CANCELLED]: HttpStatus.BAD_REQUEST,
  [status.INVALID_ARGUMENT]: HttpStatus.BAD_REQUEST,
  [status.OUT_OF_RANGE]: HttpStatus.BAD_REQUEST,
  [status.DEADLINE_EXCEEDED]: HttpStatus.GATEWAY_TIMEOUT,
  [status.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [status.ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [status.ABORTED]: HttpStatus.CONFLICT,
  [status.PERMISSION_DENIED]: HttpStatus.FORBIDDEN,
  [status.RESOURCE_EXHAUSTED]: HttpStatus.TOO_MANY_REQUESTS,
  [status.FAILED_PRECONDITION]: HttpStatus.UNPROCESSABLE_ENTITY,
  [status.UNIMPLEMENTED]: HttpStatus.NOT_IMPLEMENTED,
  [status.UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [status.UNAUTHENTICATED]: HttpStatus.UNAUTHORIZED,
};

/**
 * gateway 컨트롤러가 gRPC로 다른 서비스를 호출할 때 실패하면 RpcException이 아니라
 * grpc-js가 만든 순수 객체({code, details, metadata})가 그대로 throw된다.
 * 이 필터가 없으면 default 필터가 그걸 못 알아보고 항상 500만 내려준다.
 */
@Catch()
export class GrpcExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GrpcExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const httpStatus = exception.getStatus();
      response.status(httpStatus).json(exception.getResponse());
      return;
    }

    const grpcError = extractGrpcError(exception);
    if (grpcError) {
      const httpStatus =
        GRPC_TO_HTTP_STATUS[grpcError.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
      const message = grpcError.details || grpcError.message || 'Internal server error';

      response.status(httpStatus).json({
        statusCode: httpStatus,
        message,
        error: HttpStatus[httpStatus],
      });
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.message : exception,
      exception instanceof Error ? exception.stack : undefined,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: HttpStatus[HttpStatus.INTERNAL_SERVER_ERROR],
    });
  }
}
