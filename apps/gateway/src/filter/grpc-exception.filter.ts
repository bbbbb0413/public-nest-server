import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Response } from 'express';
import { status } from '@grpc/grpc-js';

interface GrpcErrorShape {
  code: number;
  message?: string;
}

function toGrpcError(raw: string | object): GrpcErrorShape | null {
  if (typeof raw === 'object' && raw !== null && 'code' in raw) {
    return raw as GrpcErrorShape;
  }
  return null;
}

@Catch(RpcException)
export class GrpcExceptionFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const grpcError = toGrpcError(exception.getError());
    const grpcCode = grpcError?.code;
    const message = grpcError?.message || exception.message || 'Internal server error';

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;

    switch (grpcCode) {
      case status.INVALID_ARGUMENT:
      case status.OUT_OF_RANGE:
      case status.CANCELLED:
        httpStatus = HttpStatus.BAD_REQUEST;
        break;
      case status.UNAUTHENTICATED:
        httpStatus = HttpStatus.UNAUTHORIZED;
        break;
      case status.PERMISSION_DENIED:
        httpStatus = HttpStatus.FORBIDDEN;
        break;
      case status.NOT_FOUND:
        httpStatus = HttpStatus.NOT_FOUND;
        break;
      case status.ALREADY_EXISTS:
      case status.ABORTED:
        httpStatus = HttpStatus.CONFLICT;
        break;
      case status.FAILED_PRECONDITION:
        httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;
        break;
      case status.RESOURCE_EXHAUSTED:
        httpStatus = HttpStatus.TOO_MANY_REQUESTS;
        break;
      case status.UNAVAILABLE:
        httpStatus = HttpStatus.SERVICE_UNAVAILABLE;
        break;
      case status.DEADLINE_EXCEEDED:
        httpStatus = HttpStatus.GATEWAY_TIMEOUT;
        break;
      case status.UNIMPLEMENTED:
        httpStatus = HttpStatus.NOT_IMPLEMENTED;
        break;
      default:
        httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
        break;
    }

    response.status(httpStatus).json({
      statusCode: httpStatus,
      message: message,
      error: HttpStatus[httpStatus],
    });
  }
}
