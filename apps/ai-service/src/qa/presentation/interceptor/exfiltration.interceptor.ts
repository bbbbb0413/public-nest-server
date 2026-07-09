import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SecretPiiScanner } from '../../application/filter/secret-pii-scanner';

@Injectable()
export class ExfiltrationInterceptor implements NestInterceptor {
  constructor(private readonly scanner: SecretPiiScanner) {}

  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map((data) => this.maskResponse(data)));
  }

  private maskResponse(data: unknown): unknown {
    if (typeof data === 'string') {
      return this.scanner.mask(data);
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.maskResponse(item));
    }

    if (data !== null && typeof data === 'object') {
      return Object.fromEntries(
        Object.entries(data as Record<string, unknown>).map(([key, value]) => [
          key,
          this.maskResponse(value),
        ]),
      );
    }

    return data;
  }
}
