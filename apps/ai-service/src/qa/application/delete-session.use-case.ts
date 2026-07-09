import { Inject, Injectable } from '@nestjs/common';
import {
  IConversationSessionRepository,
  ConversationSessionRepository,
} from '../domain/repository/conversation-session.repository';

@Injectable()
export class DeleteSessionUseCase {
  constructor(
    @Inject(ConversationSessionRepository)
    private readonly sessionRepo: IConversationSessionRepository,
  ) {}

  async execute(sessionId: string): Promise<void> {
    await this.sessionRepo.deleteById(sessionId);
  }
}
