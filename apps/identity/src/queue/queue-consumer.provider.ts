import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { IMailRepository } from '../mail/domain/repository/mail.repository';
import { Mail } from '../mail/domain/model/mail';

@Processor('test')
export class QueueConsumerProvider {
  private readonly logger = new Logger(QueueConsumerProvider.name);

  constructor(
    @Inject(IMailRepository) private readonly mailRepository: IMailRepository,
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
}
