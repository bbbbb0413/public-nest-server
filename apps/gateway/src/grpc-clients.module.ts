import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { getGrpcOptions, GRPC_PACKAGES } from '@libs/rpc';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'IDENTITY_SERVICE',
        ...getGrpcOptions(
          process.env.IDENTITY_GRPC_URL || 'localhost:50051',
          GRPC_PACKAGES.IDENTITY,
          'identity.proto',
        ),
      },
      {
        name: 'PAYMENT_SERVICE',
        ...getGrpcOptions(
          process.env.PAYMENT_GRPC_URL || 'localhost:50052',
          GRPC_PACKAGES.PAYMENT,
          'payment.proto',
        ),
      },
      {
        name: 'CHAT_SERVICE',
        ...getGrpcOptions(
          process.env.CHAT_GRPC_URL || 'localhost:50053',
          GRPC_PACKAGES.CHAT,
          'chat.proto',
        ),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class GrpcClientsModule {}
