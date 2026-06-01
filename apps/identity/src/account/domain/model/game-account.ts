import { AggregateRoot } from '@libs/shared-kernel';
import { Uuid } from '../vo/uuid.vo';
import { NickName } from '../vo/nick-name.vo';
import { GameAccountCreatedEvent } from '../event/game-account-created.event';

export class GameAccount extends AggregateRoot {
  private constructor(
    readonly id: number,
    readonly uuid: Uuid,
    readonly nickName: NickName,
  ) {
    super();
  }

  static create(props: { uuid: string }): GameAccount {
    const account = new GameAccount(
      undefined,
      Uuid.of(props.uuid),
      NickName.empty(),
    );
    account.addDomainEvent(new GameAccountCreatedEvent(undefined, props.uuid));
    return account;
  }

  static restore(props: {
    id: number;
    uuid: string;
    nickName: string;
  }): GameAccount {
    return new GameAccount(
      props.id,
      Uuid.of(props.uuid),
      NickName.of(props.nickName),
    );
  }
}
