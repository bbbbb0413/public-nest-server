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
    ]),
  ],
  exports: [ClientsModule],
})
export class GrpcClientsModule {}
