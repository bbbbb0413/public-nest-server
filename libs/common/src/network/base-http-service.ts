import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { HttpException, InternalServerErrorException } from '@nestjs/common';
import { AxiosError, AxiosRequestHeaders } from 'axios';

export abstract class BaseHttpService {
  protected headers?: AxiosRequestHeaders;
  protected baseUrl: string;

  protected constructor(
    protected readonly httpService: HttpService,
    protected readonly host: string,
    protected readonly port?: number,
  ) {
    this.baseUrl = this?.port ? `${this.host}:${this.port}` : `${this.host}`;
  }

  async post(options: {
    method: string;
    data?: any;
    params?: Record<string, any>;
  }): Promise<any> {
    const url = `${this.baseUrl}/${options.method}`;
    try {
      const response = await firstValueFrom(
        this.httpService.post(url, options.data, {
          headers: this.headers,
          params: options?.params,
        }),
      );
      return response.data;
    } catch (e: unknown) {
      throw this.toHttpException(e);
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
    } catch (e: unknown) {
      throw this.toHttpException(e);
    }
  }

  async patch(options: {
    method: string;
    data?: any;
    params?: Record<string, any>;
  }): Promise<any> {
    const url = `${this.baseUrl}/${options.method}`;
    try {
      const response = await firstValueFrom(
        this.httpService.patch(url, options.data, {
          headers: this.headers,
          params: options?.params,
        }),
      );
      return response.data;
    } catch (e: unknown) {
      throw this.toHttpException(e);
    }
  }

  async delete(options: { method: string; params?: Record<string, any> }): Promise<any> {
    const url = `${this.baseUrl}/${options.method}`;
    try {
      const response = await firstValueFrom(
        this.httpService.delete(url, {
          headers: this.headers,
          params: options?.params,
        }),
      );
      return response.data;
    } catch (e: unknown) {
      throw this.toHttpException(e);
    }
  }

  private toHttpException(e: unknown): HttpException {
    if (e instanceof AxiosError && e.response) {
      const body = e.response.data ?? e.message;
      return new HttpException(body, e.response.status);
    }
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new InternalServerErrorException(message);
  }
}
