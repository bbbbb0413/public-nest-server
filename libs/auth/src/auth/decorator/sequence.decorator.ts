import { applyDecorators } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

export function Sequence(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiHeader({ name: 'sequence', description: 'sequence', required: true }),
  );
}
