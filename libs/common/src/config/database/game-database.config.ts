import { registerAs } from '@nestjs/config';
import baseDatabaseConfig from './base-database.config';

export default registerAs('game-database', () => ({
  ...baseDatabaseConfig(),
  host: process.env.GAME_DB_HOST,
  port: Number(process.env.GAME_DB_PORT),
  username: process.env.GAME_DB_USER_NAME,
  password: process.env.GAME_DB_USER_PW,
  name: process.env.GAME_DB_NAME,
  database: process.env.GAME_DB_NAME,
  synchronize:
    process.env.GAME_DB_SYNCHRONIZE &&
    JSON.parse(process.env.GAME_DB_SYNCHRONIZE),
  entities: [
    __dirname + '/../../../../libs/dao/src/game/**/*.entity.{ts,js}',
    __dirname +
      '/../../../../apps/identity/src/account/infrastructure/orm/*.orm-entity.{ts,js}',
  ],
}));
