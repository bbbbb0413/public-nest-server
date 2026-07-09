import { ConversationSession } from '../model/conversation-session';

export interface IConversationSessionRepository {
  findById(sessionId: string): Promise<ConversationSession | null>;
  findByUserId(
    userId: string,
    page: number,
    limit: number,
  ): Promise<ConversationSession[]>;
  persist(session: ConversationSession): Promise<ConversationSession>;
  update(session: ConversationSession): Promise<ConversationSession>;
  deleteById(sessionId: string): Promise<void>;
}

export const ConversationSessionRepository = Symbol(
  'ConversationSessionRepository',
);
