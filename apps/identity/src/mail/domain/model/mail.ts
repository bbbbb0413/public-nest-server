import { AggregateRoot } from '@libs/shared-kernel';

export class Mail extends AggregateRoot {
  private constructor(
    readonly id: number,
    readonly userId: number,
    readonly type: number,
    readonly contents: string,
  ) {
    super();
  }

  static create(props: {
    userId: number;
    type: number;
    contents: string;
  }): Mail {
    return new Mail(undefined, props.userId, props.type, props.contents);
  }

  static restore(props: {
    id: number;
    userId: number;
    type: number;
    contents: string;
  }): Mail {
    return new Mail(props.id, props.userId, props.type, props.contents);
  }
}
