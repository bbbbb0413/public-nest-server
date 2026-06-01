export const CONNECTION_NAME = {
  PERSONAL: process.env.PERSONAL_DB_NAME,
  GAME: process.env.GAME_DB_NAME,
} as const;
export type ConnectionName =
  (typeof CONNECTION_NAME)[keyof typeof CONNECTION_NAME];
