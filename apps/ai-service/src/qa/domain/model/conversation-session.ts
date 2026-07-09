import { AggregateRoot } from '@libs/shared-kernel';
import { SessionId } from '../vo/session-id.vo';
import { ConversationTurn } from '../vo/conversation-turn.vo';

const MAX_TITLE_LENGTH = 50;

interface RestoreProps {
  sessionId: string;
  userId: string;
  title: string;
  turns: Array<{
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export class ConversationSession extends AggregateRoot {
  private constructor(
    private readonly _sessionId: SessionId,
    private readonly _userId: string,
    private readonly _title: string,
    private readonly _turns: ConversationTurn[],
    private readonly _createdAt: Date,
    private readonly _updatedAt: Date,
  ) {
    super();
  }

  static create(userId: string, firstQuestion: string): ConversationSession {
    const now = new Date();
    const title = firstQuestion.slice(0, MAX_TITLE_LENGTH);
    return new ConversationSession(
      SessionId.generate(),
      userId,
      title,
      [],
      now,
      now,
    );
  }

  static restore(props: RestoreProps): ConversationSession {
    const turns = props.turns.map((t) =>
      ConversationTurn.restore({
        role: t.role,
        content: t.content,
        createdAt: t.createdAt,
      }),
    );
    return new ConversationSession(
      SessionId.of(props.sessionId),
      props.userId,
      props.title,
      turns,
      props.createdAt,
      props.updatedAt,
    );
  }

  appendTurn(
    userContent: string,
    assistantContent: string,
  ): ConversationSession {
    const newTurns = [
      ...this._turns,
      ConversationTurn.ofUser(userContent),
      ConversationTurn.ofAssistant(assistantContent),
    ];
    return new ConversationSession(
      this._sessionId,
      this._userId,
      this._title,
      newTurns,
      this._createdAt,
      new Date(),
    );
  }

  getHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    return this._turns.map((t) => ({ role: t.role, content: t.content }));
  }

  getSessionId(): string {
    return this._sessionId.getValue();
  }

  getUserId(): string {
    return this._userId;
  }

  get title(): string {
    return this._title;
  }

  get turns(): ConversationTurn[] {
    return [...this._turns];
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
