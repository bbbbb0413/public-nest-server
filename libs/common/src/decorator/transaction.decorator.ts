import { TypeOrmHelper } from '@libs/common/databases/typeorm/typeorm.helper';
import { ContextProvider } from '@libs/common/provider/context.provider';
import {
  CONNECTION_NAME,
  ConnectionName,
} from '@libs/common/config/database.constants';

/**
 * 게임 데이터 베이스 포함
 * With Shard Database
 */
export function Transactional(
  ...databaseNames: ConnectionName[]
): MethodDecorator {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originMethod = descriptor.value;

    descriptor.value = async function (
      ...originMethodArgs: any[]
    ): Promise<PropertyDescriptor> {
      const validateDatabase = databaseNames.filter((name) => {
        return Object.values(CONNECTION_NAME)
          .filter((name) => !!name)
          .includes(name);
      });

      const session = ContextProvider.getSession();
      if (session) {
        validateDatabase.push(session.database);
      }

      await TypeOrmHelper.Transactional(validateDatabase);

      return await originMethod.apply(this, originMethodArgs);
    };

    return descriptor;
  };
}

/**
 * 게임 데이터 베이스 비 포함
 * Without Shard Database
 */
export function TransactionalEx(
  ...databaseNames: ConnectionName[]
): MethodDecorator {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originMethod = descriptor.value;

    descriptor.value = async function (
      ...originMethodArgs: any[]
    ): Promise<PropertyDescriptor> {
      const validateDatabase = databaseNames.filter((name) =>
        Object.values(CONNECTION_NAME)
          .filter((name) => !!name)
          .includes(name),
      );

      await TypeOrmHelper.Transactional(validateDatabase);

      return await originMethod.apply(this, originMethodArgs);
    };

    return descriptor;
  };
}
