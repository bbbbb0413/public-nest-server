import { ServerErrorException } from '../exception/server-error.exception';
import { INTERNAL_ERROR_CODE } from '../constants/internal-error-code.constants';

export function getDatabaseByGameDbId(_gameDbId: number): string {
  const name = process.env.GAME_DB_NAME;
  if (!name) {
    throw new ServerErrorException(INTERNAL_ERROR_CODE.ERROR);
  }
  return name;
}
