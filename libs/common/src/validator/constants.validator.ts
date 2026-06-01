import { Injectable } from '@nestjs/common';
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@Injectable()
@ValidatorConstraint({ name: 'ConstantsValidator', async: true })
export class ConstantsValidator implements ValidatorConstraintInterface {
  validate(value: string, validationArguments?: ValidationArguments): boolean {
    return this.check(value, validationArguments.constraints);
  }

  check(value: string, constraints: any): boolean {
    if (Array.isArray(constraints)) {
      for (const it of constraints) {
        if (this.check(value, it)) return true;
      }
    } else if (
      typeof constraints === 'string' ||
      typeof constraints === 'number'
    ) {
      return value === constraints;
    } else {
      for (const key in constraints) {
        if (constraints[key] !== undefined || constraints[key] !== null) {
          if (this.check(value, constraints[key])) return true;
        }
      }
    }

    return false;
  }
}
