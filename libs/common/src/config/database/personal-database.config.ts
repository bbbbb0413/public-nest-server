import { registerAs } from '@nestjs/config';
import baseDatabaseConfig from './base-database.config';

export default registerAs('personal-database', () => ({
  ...baseDatabaseConfig(),
  host: process.env.PERSONAL_DB_HOST,
  port: Number(process.env.PERSONAL_DB_PORT),
  username: process.env.PERSONAL_DB_USER_NAME,
  password: process.env.PERSONAL_DB_USER_PW,
  name: process.env.PERSONAL_DB_NAME,
  database: process.env.PERSONAL_DB_NAME,
  synchronize:
    process.env.PERSONAL_DB_SYNCHRONIZE &&
    JSON.parse(process.env.PERSONAL_DB_SYNCHRONIZE),
  entities: [
    __dirname + '/../../../../../libs/dao/src/personal/**/*.entity.{ts,js}',
    __dirname + '/../../../../../libs/dao/src/payment/**/*.entity.{ts,js}',
    __dirname +
      '/../../../../../libs/auth/src/user/infrastructure/orm/*.orm-entity.{ts,js}',
    __dirname +
      '/../../../../../apps/identity/src/mail/infrastructure/orm/*.orm-entity.{ts,js}',
    __dirname +
      '/../../../../../apps/payment/src/payment/infrastructure/orm/*.orm-entity.{ts,js}',
  ],
}));
