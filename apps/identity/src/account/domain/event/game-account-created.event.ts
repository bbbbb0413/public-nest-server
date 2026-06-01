import { DomainEvent } from '@libs/shared-kernel';

export class GameAccountCreatedEvent extends DomainEvent {
  constructor(readonly accountId: number, readonly uuid: string) {
    super();
  }
}
