import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_DB_HOST,
  port: Number(process.env.REDIS_DB_PORT),
  sshUsed: process.env.SSH_USED && JSON.parse(process.env.SSH_USED),
}));
