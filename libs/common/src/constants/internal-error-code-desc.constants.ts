import { INTERNAL_ERROR_CODE as e } from './internal-error-code.constants';

export const INTERNAL_ERROR_CODE_DESC = {
  [e.ERROR]: '에러',

  [e.DB_UPDATE_FAILED]: 'db 업데이트 실패',
} as const;

export const BATCH_INTERNAL_ERROR_CODE_DESC = {} as const;
