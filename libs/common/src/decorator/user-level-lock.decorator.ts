import { ContextProvider } from '@libs/common/provider/context.provider';
import { TypeOrmHelper } from '@libs/common/databases/typeorm/typeorm.helper';
import { ServerErrorException } from '@libs/common/exception/server-error.exception';
import { INTERNAL_ERROR_CODE } from '@libs/common/constants/internal-error-code.constants';
import * as process from 'process';

export function UserLevelLock(): MethodDecorator {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originMethod = descriptor.value;

    descriptor.value = async function (
      ...originMethodArgs: any[]
    ): Promise<PropertyDescriptor> {
      const session = ContextProvider.getSession();
      const queryRunners = TypeOrmHelper.getQueryRunners();

      const getUserLevelLock = async (
        database: string,
        id: string,
      ): Promise<void> => {
        const queryRunner =
          queryRunners?.[database] ??
          (await TypeOrmHelper.createQueryRunner(database));

        const USER_LEVEL_LOCK_TIME =
          Number(process.env.USER_LEVEL_LOCK_TIME) || 1;

        // lock
        const [result] = await queryRunner.query(
          `SELECT GET_LOCK('${id}', ${USER_LEVEL_LOCK_TIME});`,
        );

        // check result
        if (Number(Object.values(result)[0]) !== 1) {
          throw new ServerErrorException(INTERNAL_ERROR_CODE.ERROR);
        }

        TypeOrmHelper.addQueryRunner(database, queryRunner);
      };

      if (session) {
        const { uuid, database } = session;
        await getUserLevelLock(database, uuid);
      }

      return await originMethod.apply(this, originMethodArgs);
    };

    Object.defineProperty(descriptor.value, 'name', {
      value: propertyKey,
    });

    return descriptor;
  };
}
