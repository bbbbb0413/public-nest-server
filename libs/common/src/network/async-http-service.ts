import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosRequestHeaders } from 'axios';
import { Logger } from '@nestjs/common';

export abstract class AsyncHttpService {
  protected baseUrl: string;
  protected headers?: AxiosRequestHeaders;
  protected data?: any;

  protected constructor(
    protected readonly httpService: HttpService,
    protected readonly host: string,
    protected readonly port?: number,
  ) {
    this.baseUrl = this?.port ? `${this.host}:${this.port}` : `${this.host}`;
  }

  async post(options: { method: string; data?: any }): Promise<any> {
    const url = `${this.baseUrl}/${options.method}`;
    this.data = options.data ? JSON.stringify(options.data) : undefined;
    try {
      await firstValueFrom(
        this.httpService.post(url, this?.data, { headers: this.headers }),
      );
    } catch (e) {
      Logger.error(e);
    }
  }
}
