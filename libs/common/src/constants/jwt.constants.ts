export const JWT_OPTIONS = {
  expiresIn: 60 * 60 * 24 * 30,
};

export interface JwtPayload {
  id: number;
  name: string;
  email: string;
  activatedAt: Date;
}
