import { ValueObject } from '@libs/shared-kernel';

interface TurnValue {
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export class ConversationTurn extends ValueObject<TurnValue> {
  protected validate(value: TurnValue): void {
    if (!value.content || value.content.trim().length === 0) {
      throw new Error('turn content는 비어있을 수 없습니다.');
    }
    if (value.role !== 'user' && value.role !== 'assistant') {
      throw new Error('role은 user 또는 assistant이어야 합니다.');
    }
  }

  static ofUser(content: string): ConversationTurn {
    return new ConversationTurn({
      role: 'user',
      content,
      createdAt: new Date(),
    });
  }

  static ofAssistant(content: string): ConversationTurn {
    return new ConversationTurn({
      role: 'assistant',
      content,
      createdAt: new Date(),
    });
  }

  static restore(value: TurnValue): ConversationTurn {
    return new ConversationTurn(value);
  }

  get role(): 'user' | 'assistant' {
    return this.value.role;
  }

  get content(): string {
    return this.value.content;
  }

  get createdAt(): Date {
    return this.value.createdAt;
  }
}
