import '@extension/array.extension';
import '@extension/json.extension';
import '@extension/date.extension';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

const environment = process.env.NODE_ENV || 'test';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `./config/.ai-service.${environment}.env`,
      isGlobal: true,
      cache: true,
    }),
  ],
})
export class AiServerConfig {}
