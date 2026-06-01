import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBasicAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { BasicAuthGuard } from '../guard/basic-auth.guard';

export function Auth(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    UseGuards(BasicAuthGuard),
    ApiBasicAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
  );
}
