import { Inject, Injectable } from '@nestjs/common';
import { ConversationSession } from '../domain/model/conversation-session';
import {
  IConversationSessionRepository,
  ConversationSessionRepository,
} from '../domain/repository/conversation-session.repository';

@Injectable()
export class GetSessionUseCase {
  constructor(
    @Inject(ConversationSessionRepository)
    private readonly sessionRepo: IConversationSessionRepository,
  ) {}

  async execute(sessionId: string): Promise<ConversationSession | null> {
    return this.sessionRepo.findById(sessionId);
  }
}
