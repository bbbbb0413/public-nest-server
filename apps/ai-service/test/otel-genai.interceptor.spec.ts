import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { trace } from '@opentelemetry/api';

jest.mock('@opentelemetry/api');

import { OtelGenaiInterceptor } from '@libs/common/observability/otel-genai.interceptor';
import { GEN_AI } from '@libs/common/observability/otel-genai.constants';

describe('OtelGenaiInterceptor', () => {
  const mockEnd = jest.fn();
  const mockSetAttribute = jest.fn();
  const mockRecordException = jest.fn();
  const mockSpan = {
    setAttribute: mockSetAttribute,
    end: mockEnd,
    recordException: mockRecordException,
  };
  const mockStartSpan = jest.fn().mockReturnValue(mockSpan);

  beforeEach(() => {
    jest.clearAllMocks();
    (trace.getTracer as jest.Mock).mockReturnValue({
      startSpan: mockStartSpan,
    });
  });

  it('정상 완료 시 operation.duration 속성을 기록하고 span.end()를 호출한다', async () => {
    // Arrange
    const interceptor = new OtelGenaiInterceptor();
    const context = {} as ExecutionContext;
    const handler: CallHandler = { handle: () => of('response') };

    // Act
    await lastValueFrom(interceptor.intercept(context, handler));

    // Assert
    expect(mockSetAttribute).toHaveBeenCalledWith(
      GEN_AI.OPERATION_DURATION,
      expect.any(Number),
    );
    expect(mockEnd).toHaveBeenCalledTimes(1);
  });

  it('에러 발생 시 recordException을 호출하고 span.end()를 호출한다', async () => {
    // Arrange
    const interceptor = new OtelGenaiInterceptor();
    const context = {} as ExecutionContext;
    const error = new Error('LLM 오류');
    const handler: CallHandler = { handle: () => throwError(() => error) };

    // Act
    try {
      await lastValueFrom(interceptor.intercept(context, handler));
    } catch {
      // expected
    }

    // Assert
    expect(mockRecordException).toHaveBeenCalledWith(error);
    expect(mockEnd).toHaveBeenCalledTimes(1);
  });

  it('unknown 타입 에러도 Error 객체로 래핑하여 recordException에 전달한다', async () => {
    // Arrange
    const interceptor = new OtelGenaiInterceptor();
    const context = {} as ExecutionContext;
    const handler: CallHandler = {
      handle: () => throwError(() => 'string-error'),
    };

    // Act
    try {
      await lastValueFrom(interceptor.intercept(context, handler));
    } catch {
      // expected
    }

    // Assert
    expect(mockRecordException).toHaveBeenCalledWith(expect.any(Error));
    expect(mockEnd).toHaveBeenCalledTimes(1);
  });

  it('invoke_agent 스팬을 시작하고 OPERATION_NAME 속성을 기록한다', async () => {
    // Arrange
    const interceptor = new OtelGenaiInterceptor();
    const context = {} as ExecutionContext;
    const handler: CallHandler = { handle: () => of('ok') };

    // Act
    await lastValueFrom(interceptor.intercept(context, handler));

    // Assert
    expect(mockStartSpan).toHaveBeenCalledWith('invoke_agent');
    expect(mockSetAttribute).toHaveBeenCalledWith(
      GEN_AI.OPERATION_NAME,
      'invoke_agent',
    );
  });
});
