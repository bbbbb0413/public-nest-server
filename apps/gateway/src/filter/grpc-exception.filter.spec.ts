import { GrpcExceptionFilter } from './grpc-exception.filter';
import { ArgumentsHost } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';

describe('GrpcExceptionFilter', () => {
  let filter: GrpcExceptionFilter;
  let mockResponse: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GrpcExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({}),
      }),
    } as unknown as ArgumentsHost;
  });

  const runTest = (grpcCode: number, expectedHttpStatus: number) => {
    const errorObj = { code: grpcCode, message: 'gRPC error message' };
    const exception = new RpcException(errorObj);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(expectedHttpStatus);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: expectedHttpStatus,
        message: 'gRPC error message',
      }),
    );
  };

  it('INVALID_ARGUMENT (3)는 400으로 매핑되어야 한다', () => {
    runTest(status.INVALID_ARGUMENT, 400);
  });

  it('UNAUTHENTICATED (16)는 401로 매핑되어야 한다', () => {
    runTest(status.UNAUTHENTICATED, 401);
  });

  it('PERMISSION_DENIED (7)는 403로 매핑되어야 한다', () => {
    runTest(status.PERMISSION_DENIED, 403);
  });

  it('NOT_FOUND (5)는 404로 매핑되어야 한다', () => {
    runTest(status.NOT_FOUND, 404);
  });

  it('ALREADY_EXISTS (6)는 409로 매핑되어야 한다', () => {
    runTest(status.ALREADY_EXISTS, 409);
  });

  it('FAILED_PRECONDITION (9)는 422로 매핑되어야 한다', () => {
    runTest(status.FAILED_PRECONDITION, 422);
  });

  it('UNAVAILABLE (14)는 503로 매핑되어야 한다', () => {
    runTest(status.UNAVAILABLE, 503);
  });

  it('DEADLINE_EXCEEDED (4)는 504로 매핑되어야 한다', () => {
    runTest(status.DEADLINE_EXCEEDED, 504);
  });

  it('RESOURCE_EXHAUSTED (8)는 429로 매핑되어야 한다', () => {
    runTest(status.RESOURCE_EXHAUSTED, 429);
  });

  it('ABORTED (10)는 409로 매핑되어야 한다', () => {
    runTest(status.ABORTED, 409);
  });

  it('OUT_OF_RANGE (11)는 400으로 매핑되어야 한다', () => {
    runTest(status.OUT_OF_RANGE, 400);
  });

  it('UNIMPLEMENTED (12)는 501로 매핑되어야 한다', () => {
    runTest(status.UNIMPLEMENTED, 501);
  });

  it('CANCELLED (1)는 400으로 매핑되어야 한다', () => {
    runTest(status.CANCELLED, 400);
  });

  it('알 수 없는 gRPC status는 500으로 매핑되어야 한다', () => {
    runTest(status.INTERNAL, 500);
  });

  it('RpcException으로 감싸지 않은 순수 grpc-js 에러 객체도 처리해야 한다', () => {
    // @nestjs/microservices의 ClientGrpc는 실패 시 RpcException이 아니라
    // grpc-js가 만든 {code, details, metadata} 형태의 순수 객체를 그대로 던진다.
    const rawGrpcError = { code: status.INVALID_ARGUMENT, details: '이메일 형식이 아닙니다' };

    filter.catch(rawGrpcError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: '이메일 형식이 아닙니다' }),
    );
  });

  it('HttpException은 자기 status/response를 그대로 유지해야 한다', () => {
    const { UnauthorizedException } = jest.requireActual('@nestjs/common');
    const exception = new UnauthorizedException('세션이 만료되었습니다');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: '세션이 만료되었습니다' }),
    );
  });
});
