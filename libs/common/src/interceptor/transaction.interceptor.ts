import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, Observable, mergeMap } from 'rxjs';
import { TypeOrmHelper } from '@libs/common/databases/typeorm/typeorm.helper';

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    return next.handle().pipe(
      // exception
      catchError(async (e) => {
        await TypeOrmHelper.rollbackTransactions();
        throw e;
      }),

      // execute
      mergeMap(async (res) => {
        await TypeOrmHelper.commitTransactions();
        return res;
      }),
    );
  }
}
