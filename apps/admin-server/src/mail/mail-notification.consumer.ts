import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { Job } from 'bull';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { IdentityServiceClient } from '@libs/rpc';

interface SendMailJobData {
  userId: number;
}

@Processor('mail')
export class MailNotificationConsumer implements OnModuleInit {
  private readonly logger = new Logger(MailNotificationConsumer.name);
  private identityService: IdentityServiceClient;

  constructor(
    @Inject('IDENTITY_SERVICE') private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.identityService =
      this.client.getService<IdentityServiceClient>('IdentityService');
  }

  @Process('send-mail')
  async sendMail(job: Job<SendMailJobData>): Promise<void> {
    const { userId } = job.data;

    await firstValueFrom(
      this.identityService.sendMail({
        accountId: userId,
        title: '가입 축하',
        body: '가입을 축하합니다.',
      }),
    );
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
