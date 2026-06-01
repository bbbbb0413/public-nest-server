import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication, Logger } from '@nestjs/common';
import { SWAGGER_CUSTOM_OPTIONS } from '@libs/common/constants/swagger.constants';

export class PaymentServer {
  constructor(private readonly app: INestApplication) {}

  /**
   * initialize server
   */
  init(): void {
    this.app.setGlobalPrefix('');
    this._initializeSwagger();
  }

  /**
   * execute server
   */
  async run(): Promise<void> {
    Logger.log('Payment Server is running on port ' + process.env.SERVER_PORT);
    await this.app.listen(process.env.SERVER_PORT, '0.0.0.0');
  }

  /**
   * OPEN API(Swagger) 초기화
   */
  private _initializeSwagger(): void {
    if (!['prod'].includes(process.env.NODE_ENV)) {
      const config = new DocumentBuilder()
        .setTitle('Payment Server')
        .setDescription('The Payment API description')
        .setVersion('1.0')
        .addApiKey(
          {
            type: 'apiKey',
            name: 'X-API-KEY',
            in: 'header',
            description: 'api key',
          },
          'apiKey',
        )
        .addBasicAuth(
          {
            type: 'http',
            name: 'Authorization',
            in: 'header',
            description: 'Username: id & Password: sessionId',
          },
          'basic',
        )
        .build();

      const document = SwaggerModule.createDocument(this.app, config);

      SwaggerModule.setup(
        'api-docs',
        this.app,
        document,
        SWAGGER_CUSTOM_OPTIONS,
      );
    }
  }
}
