import '@extension/array.extension';
import '@extension/json.extension';
import '@extension/date.extension';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import PersonalDatabaseConfig from '@libs/common/config/database/personal-database.config';
import GameDatabaseConfig from '@libs/common/config/database/game-database.config';

const environment = process.env.NODE_ENV || 'test';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `./config/.gateway.${environment}.env`,
      isGlobal: true,
      cache: true,
      load: [PersonalDatabaseConfig, GameDatabaseConfig],
    }),
  ],
})
export class GatewayConfigModule {}
