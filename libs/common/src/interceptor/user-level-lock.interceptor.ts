import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, Observable, mergeMap } from 'rxjs';
import { ContextProvider } from '@libs/common/provider/context.provider';
import { TypeOrmHelper } from '@libs/common/databases/typeorm/typeorm.helper';
import { Session } from '@libs/shared-kernel';
import { getDatabaseByGameDbId } from '@libs/common/utils/game-database.util';

@Injectable()
export class UserLevelLockInterceptor implements NestInterceptor {
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    return next.handle().pipe(
      catchError(async (e) => {
        await this.release();
        throw e;
      }),
      mergeMap(async (res) => {
        await this.release();
        return res;
      }),
    );
  }

  async release(): Promise<void> {
    const session = ContextProvider.get('session');
    if (!session) {
      await TypeOrmHelper.releases();
      TypeOrmHelper.releaseQueryRunner();
      return;
    }
    const queryRunners = TypeOrmHelper.getQueryRunners();
    try {
      const { gameDbId, uuid } = session as Session;
      const database = getDatabaseByGameDbId(gameDbId);
      if (queryRunners?.[database]) {
        await queryRunners[database]?.query(`SELECT RELEASE_LOCK('${uuid}');`);
      }
      // eslint-disable-next-line no-useless-catch
    } catch (e) {
      throw e;
    } finally {
      await TypeOrmHelper.releases();
      TypeOrmHelper.releaseQueryRunner();
    }
  }
}
