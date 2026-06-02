import { join } from 'path';
import { GrpcOptions, Transport } from '@nestjs/microservices';

export function getGrpcOptions(
  url: string,
  packageName: string,
  protoFileName: string,
): GrpcOptions {
  const protoDir = join(__dirname, '..', 'proto');
  const protoPath = join(protoDir, protoFileName);
  
  return {
    transport: Transport.GRPC,
    options: {
      url,
      package: packageName,
      protoPath,
      loader: {
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [protoDir],
      },
    },
  };
}
