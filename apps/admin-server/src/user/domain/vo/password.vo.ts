import * as bcrypt from 'bcryptjs';

export class Password {
  private constructor(private readonly hashed: string) {}

  static async hash(raw: string): Promise<Password> {
    const hashed = await bcrypt.hash(raw, 10);
    return new Password(hashed);
  }

  static fromHashed(hashed: string): Password {
    return new Password(hashed);
  }

  compare(raw: string): Promise<boolean> {
    return bcrypt.compare(raw, this.hashed);
  }

  getHashed(): string {
    return this.hashed;
  }
}
