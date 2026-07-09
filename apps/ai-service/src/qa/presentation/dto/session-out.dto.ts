import { ConversationSession } from '../../domain/model/conversation-session';

export class SessionOutDto {
  sessionId: string;
  title: string;
  updatedAt: Date;

  static fromDomain(session: ConversationSession): SessionOutDto {
    const dto = new SessionOutDto();
    dto.sessionId = session.getSessionId();
    dto.title = session.title;
    dto.updatedAt = session.updatedAt;
    return dto;
  }
}

export class SessionDetailOutDto {
  sessionId: string;
  title: string;
  turns: Array<{
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;

  static fromDomain(session: ConversationSession): SessionDetailOutDto {
    const dto = new SessionDetailOutDto();
    dto.sessionId = session.getSessionId();
    dto.title = session.title;
    dto.turns = session.turns.map((t) => ({
      role: t.role,
      content: t.content,
      createdAt: t.createdAt,
    }));
    dto.createdAt = session.createdAt;
    dto.updatedAt = session.updatedAt;
    return dto;
  }
}
