export const INTERNAL_ERROR_CODE = {
  ERROR: 1,

  DB_UPDATE_FAILED: 10001,
} as const;

export type InternalErrorCode =
  (typeof INTERNAL_ERROR_CODE)[keyof typeof INTERNAL_ERROR_CODE];

export const BATCH_INTERNAL_ERROR_CODE = {} as const;
