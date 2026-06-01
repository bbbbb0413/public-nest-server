import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InternalServerErrorException } from '@nestjs/common';
import { AxiosRequestHeaders } from 'axios';

export abstract class BaseHttpService {
  protected headers?: AxiosRequestHeaders;
  protected baseUrl: string;
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
      const response = await firstValueFrom(
        this.httpService.post(url, this?.data, { headers: this.headers }),
      );
      return response.data;
    } catch (e) {
      throw new InternalServerErrorException(e.status, e.statusText);
    }
  }

  async get(options: {
    method: string;
    params?: Record<string, any>;
  }): Promise<any> {
    const url = `${this.baseUrl}/${options.method}`;
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: this.headers,
          params: options?.params,
        }),
      );
      return response.data;
    } catch (e) {
      throw new InternalServerErrorException(e.status, e.statusText);
    }
  }
}
