import { InternalServerErrorException } from '@nestjs/common';
import {
  INTERNAL_ERROR_CODE,
  InternalErrorCode,
} from '@libs/common/constants/internal-error-code.constants';

export class ServerErrorException extends InternalServerErrorException {
  public readonly ignoreExceptionLog: boolean;

  constructor(
    errorCode: InternalErrorCode,
    errorMessage?: string,
    ignoreExceptionLog = false,
  ) {
    super(errorCode);
    this.message =
      errorMessage || ServerErrorException.errorCodeToString(errorCode);
    this.ignoreExceptionLog = ignoreExceptionLog;
  }

  static errorCodeToString(errorCode: InternalErrorCode): string {
    const codeName = Object.keys(INTERNAL_ERROR_CODE).find(
      (key) => INTERNAL_ERROR_CODE[key] === errorCode,
    );

    return codeName || 'ERROR_CODE_UNKNOWN';
  }
}
