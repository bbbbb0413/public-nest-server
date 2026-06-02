import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { SWAGGER_CUSTOM_OPTIONS } from '@libs/common/constants/swagger.constants';
import { GrpcExceptionFilter } from './filter/grpc-exception.filter';

export class GatewayServer {
  constructor(private readonly app: INestApplication) {}

  init(): void {
    this.app.setGlobalPrefix('');
    this.app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    this.app.useGlobalFilters(new GrpcExceptionFilter());
    this._initializeSwagger();
  }

  async run(): Promise<void> {
    const port = process.env.GATEWAY_HTTP_PORT || 3000;
    Logger.log('Gateway Server is running on port ' + port);
    await this.app.listen(port, '0.0.0.0');
  }

  private _initializeSwagger(): void {
    if (!['prod'].includes(process.env.NODE_ENV)) {
      const config = new DocumentBuilder()
        .setTitle('Gateway Server')
        .setDescription('The Gateway API description')
        .setVersion('1.0')
        .addBearerAuth(
          {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            name: 'JWT',
            description: 'Enter JWT token',
            in: 'header',
          },
          'jwt',
        )
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
