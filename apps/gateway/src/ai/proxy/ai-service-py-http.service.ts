import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { BaseHttpService } from '@libs/common/network/base-http-service';

@Injectable()
export class AiServicePyHttpService extends BaseHttpService {
  constructor(httpService: HttpService) {
    super(
      httpService,
      process.env.AI_SERVICE_PY_URL || 'http://ai-service-py:3004',
    );
  }
}
