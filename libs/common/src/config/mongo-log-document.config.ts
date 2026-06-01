import { registerAs } from '@nestjs/config';

export default registerAs('mongo-log-document', () => ({
  uri: process.env.COMMON_LOG_DOCUMENT_URI,
  user: process.env.COMMON_LOG_DOCUMENT_USER,
  pass: process.env.COMMON_LOG_DOCUMENT_PASS,
  dspName: process.env.COMMON_LOG_DOCUMENT_DSP_NAME,
  dspDatabase: process.env.COMMON_LOG_DOCUMENT_DSP_DATABASE,
  ehName: process.env.COMMON_LOG_DOCUMENT_EH_NAME,
  ehDatabase: process.env.COMMON_LOG_DOCUMENT_EH_DATABASE,
}));
