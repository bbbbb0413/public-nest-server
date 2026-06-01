import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import dotenv = require('dotenv');

const environment = process.env.NODE_ENV;

dotenv.config();
dotenv.config({
  path: `./config/.identity.${environment}.env`,
});

const configService = new ConfigService();

if (!configService.get('PERSONAL_DB_HOST')) {
  throw Error('Not Exist Config');
}

export default new DataSource({
  type: 'mysql',
  charset: 'utf8mb4',
  timezone: 'Z',
  host: configService.get('PERSONAL_DB_HOST'),
  port: configService.get('PERSONAL_DB_PORT'),
  username: configService.get('PERSONAL_DB_USER_NAME'),
  password: configService.get('PERSONAL_DB_USER_PW'),
  database: configService.get('PERSONAL_DB_NAME'),
  synchronize: false,
  entities: ['./libs/dao/src/personal/**/*.entity.ts'],
  migrationsRun: false,
  migrations: [
    './libs/common/src/databases/typeorm/migrations/personal/*.ts',
  ],
  migrationsTableName: 'migrations',
});
