import { ClsServiceManager } from 'nestjs-cls';
import { Session } from '@libs/shared-kernel';
import { getDatabaseByGameDbId } from '../utils/game-database.util';
import { INTERNAL_ERROR_CODE } from '@libs/common/constants/internal-error-code.constants';
import { ServerErrorException } from '@libs/common/exception/server-error.exception';

// test debugging 용
export const context = {};

export class ContextProvider {
  static get<T>(key: string): T {
    return process.env.NODE_ENV === 'test'
      ? context[key]
      : ClsServiceManager.getClsService().get(key);
  }

  static set<T>(key: string, value: T): void {
    process.env.NODE_ENV === 'test'
      ? (context[key] = value)
      : ClsServiceManager.getClsService().set(key, value);
  }

  static getSession(check = true): Session {
    const session: Session = ContextProvider.get('session');

    if (check && !session) {
      throw new ServerErrorException(INTERNAL_ERROR_CODE.ERROR);
    }
    if (!session) {
      return null;
    }

    session.database = session.gameDbId
      ? getDatabaseByGameDbId(session.gameDbId)
      : null;

    return session;
  }
}
