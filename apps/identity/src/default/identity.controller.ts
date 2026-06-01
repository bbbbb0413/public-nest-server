import { Controller, Get, Logger } from '@nestjs/common';
import { ApiResponseEntity } from '@libs/common/decorator/api-response-entity';

@Controller()
export class IdentityController {
  constructor() {}

  @Get('health')
  @ApiResponseEntity({ summary: 'default check' })
  healthCheck(): Record<string, string> {
    return { environment: process.env.NODE_ENV };
  }
}
