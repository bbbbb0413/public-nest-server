import { AggregateRoot } from '@libs/shared-kernel';
import { Email } from '../vo/email.vo';
import { Password } from '../vo/password.vo';

export class User extends AggregateRoot {
  private constructor(
    readonly id: number,
    readonly name: string,
    readonly email: Email,
    readonly password: Password,
    readonly activatedAt: Date | null,
  ) {
    super();
  }

  static create(props: {
    name: string;
    email: Email;
    password: Password;
  }): User {
    return new User(undefined, props.name, props.email, props.password, null);
  }

  static restore(props: {
    id: number;
    name: string;
    email: string;
    password: string;
    activatedAt: Date | null;
  }): User {
    return new User(
      props.id,
      props.name,
      Email.of(props.email),
      Password.fromHashed(props.password),
      props.activatedAt,
    );
  }

  async checkPassword(raw: string): Promise<boolean> {
    return this.password.compare(raw);
  }
}
