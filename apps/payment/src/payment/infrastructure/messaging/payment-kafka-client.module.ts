import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

export const PAYMENT_KAFKA_CLIENT = 'PAYMENT_KAFKA_CLIENT';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: PAYMENT_KAFKA_CLIENT,
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'payment-producer',
            brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
          },
          producer: {
            allowAutoTopicCreation: false,
          },
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class PaymentKafkaClientModule {}
