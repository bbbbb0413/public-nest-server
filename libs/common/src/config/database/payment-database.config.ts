import { registerAs } from '@nestjs/config';
import baseDatabaseConfig from './base-database.config';

export default registerAs('payment-database', () => ({
  ...baseDatabaseConfig(),
  host: process.env.PAYMENT_DB_HOST,
  port: Number(process.env.PAYMENT_DB_PORT),
  username: process.env.PAYMENT_DB_USER_NAME,
  password: process.env.PAYMENT_DB_USER_PW,
  name: process.env.PAYMENT_DB_NAME,
  database: process.env.PAYMENT_DB_NAME,
  synchronize:
    process.env.PAYMENT_DB_SYNCHRONIZE &&
    JSON.parse(process.env.PAYMENT_DB_SYNCHRONIZE),
  entities: [
    __dirname + '/../../../../libs/dao/src/payment/**/*.entity.{ts,js}',
    __dirname +
      '/../../../../apps/payment/src/payment/infrastructure/orm/*.orm-entity.{ts,js}',
  ],
}));
