import { Inject, Injectable } from '@nestjs/common';
import { ConversationSession } from '../domain/model/conversation-session';
import {
  IConversationSessionRepository,
  ConversationSessionRepository,
} from '../domain/repository/conversation-session.repository';

@Injectable()
export class GetSessionsUseCase {
  constructor(
    @Inject(ConversationSessionRepository)
    private readonly sessionRepo: IConversationSessionRepository,
  ) {}

  async execute(
    userId: string,
    page: number,
    limit: number,
  ): Promise<ConversationSession[]> {
    return this.sessionRepo.findByUserId(userId, page, limit);
  }
}
