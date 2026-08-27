import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';

@Catch()
export class RpcErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(RpcErrorFilter.name);

  catch(exception: unknown, _host: ArgumentsHost): Observable<never> {
    if (exception instanceof RpcException) {
      return throwError(() => exception);
    }

    const message =
      exception instanceof Error ? exception.message : 'Internal error';
    this.logger.error(message, exception instanceof Error ? exception.stack : undefined);

    return throwError(() => new RpcException(message));
  }
}
