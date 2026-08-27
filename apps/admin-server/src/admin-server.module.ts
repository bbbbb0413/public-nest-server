import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AdminServerConfig } from './config/admin-server-config';
import { GrpcClientsModule } from './grpc-clients.module';
import { MailNotificationConsumer } from './mail/mail-notification.consumer';

@Module({
  imports: [
    AdminServerConfig,
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_DB_HOST,
        port: Number(process.env.REDIS_DB_PORT),
      },
    }),
    BullModule.registerQueue({ name: 'mail' }),
    GrpcClientsModule,
  ],
  providers: [MailNotificationConsumer],
})
export class AdminServerModule {}
