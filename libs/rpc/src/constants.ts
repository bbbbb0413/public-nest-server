export const GRPC_PORTS = {
  IDENTITY: 50051,
  PAYMENT: 50052,
  CHAT: 50053,
} as const;

export const GRPC_PACKAGES = {
  AUTH: 'rpc.auth',
  IDENTITY: 'rpc.identity',
  PAYMENT: 'rpc.payment',
  CHAT: 'rpc.chat',
} as const;

export const GRPC_SERVICES = {
  AUTH: 'AuthService',
  IDENTITY: 'IdentityService',
  PAYMENT: 'PaymentService',
  CHAT: 'ChatService',
} as const;

export const METADATA_KEYS = {
  SESSION_ID: 'x-session-id',
  SESSION_UUID: 'x-session-uuid',
  SESSION_NICKNAME: 'x-session-nickname',
  SESSION_GAME_DB_ID: 'x-session-game-db',
  SESSION_DATABASE: 'x-session-database',
} as const;
