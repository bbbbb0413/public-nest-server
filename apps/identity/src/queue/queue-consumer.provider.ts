import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { RedisChatRepository } from '../infrastructure/redis/chat/redis-chat.repository';
import { CHAT_HISTORY_MAX_COUNT } from '@libs/common/constants/chat.constants';
import { IMailRepository } from '../mail/domain/repository/mail.repository';
import { Mail } from '../mail/domain/model/mail';

@Processor('test')
export class QueueConsumerProvider {
  private readonly logger = new Logger(QueueConsumerProvider.name);

  constructor(
    @Inject(IMailRepository) private readonly mailRepository: IMailRepository,
    private readonly redisChatRepository: RedisChatRepository,
  ) {}

  @Process('send-mail')
  async sendMail(job: Job): Promise<void> {
    const { userId } = job.data;
    const mail = Mail.create({ userId, type: 0, contents: '가입 축하' });

    try {
      await this.mailRepository.persist(mail);
    } catch (e) {
      this.logger.error(`${userId} 발송 실패: ${e.message}`);
    }
  }

  @OnQueueActive({ name: 'send-mail' })
  onActive(job: Job): void {
    this.logger.log(`작업 시작: ${job.id}`);
  }

  @OnQueueCompleted({ name: 'send-mail' })
  onCompleted(job: Job): void {
    this.logger.log(`작업 완료: ${job.id}`);
  }

  @OnQueueFailed({ name: 'send-mail' })
  onFailed(job: Job, error: Error): void {
    this.logger.error(`작업 실패: ${job.id}, 에러: ${error.message}`);
  }

  @Process('chat')
  async chat(job: Job): Promise<void> {
    const { chatHistoryKey } = job.data;

    const chatHistories = await this.redisChatRepository.getAllChat(
      chatHistoryKey,
    );

    if (CHAT_HISTORY_MAX_COUNT < chatHistories.length) {
      const chat = await this.redisChatRepository.popChat(chatHistoryKey);
      this.logger.debug(JSON.stringify(chat));
    }
  }

  @OnQueueActive({ name: 'chat' })
  onActiveChat(job: Job): void {
    this.logger.log(`작업 시작: ${job.id}`);
  }

  @OnQueueCompleted({ name: 'chat' })
  onCompletedChat(job: Job): void {
    this.logger.log(`작업 완료: ${job.id}`);
  }

  @OnQueueFailed({ name: 'chat' })
  onFailedChat(job: Job, error: Error): void {
    this.logger.error(`작업 실패: ${job.id}, 에러: ${error.message}`);
  }
}
