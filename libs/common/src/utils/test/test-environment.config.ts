import '@extension/array.extension';
import '@extension/json.extension';
import '@extension/date.extension';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import PersonalDatabaseConfig from '@libs/common/config/database/personal-database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: './config/.identity.test.env',
      isGlobal: true,
      cache: true,
      load: [PersonalDatabaseConfig],
    }),
  ],
})
export class TestEnvironmentConfig {}
