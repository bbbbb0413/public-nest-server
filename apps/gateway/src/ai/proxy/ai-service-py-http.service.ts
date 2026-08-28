import { HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { BaseHttpService } from '@libs/common/network/base-http-service';

export interface BinaryFile {
  data: Buffer;
  contentType: string;
  contentDisposition?: string;
}

@Injectable()
export class AiServicePyHttpService extends BaseHttpService {
  constructor(httpService: HttpService) {
    super(
      httpService,
      process.env.AI_SERVICE_PY_URL || 'http://ai-service-py:3004',
    );
  }

  /** JSON이 아닌 바이너리 응답(파일 다운로드 등)을 그대로 전달받는다. */
  async getBinary(method: string): Promise<BinaryFile> {
    const url = `${this.baseUrl}/${method}`;
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { responseType: 'arraybuffer' }),
      );
      const contentType = response.headers['content-type'];
      const contentDisposition = response.headers['content-disposition'];
      return {
        data: Buffer.from(response.data),
        contentType: contentType ? String(contentType) : 'application/octet-stream',
        contentDisposition: contentDisposition ? String(contentDisposition) : undefined,
      };
    } catch (e: unknown) {
      throw this.toBinaryHttpException(e);
    }
  }

  /**
   * arraybuffer 응답 실패 시 e.response.data도 ArrayBuffer라 그대로 노출하면
   * 안 읽히는 바이너리가 예외 본문에 실린다 — JSON으로 디코드를 시도한다.
   */
  private toBinaryHttpException(e: unknown): HttpException {
    if (e instanceof AxiosError && e.response) {
      let body: unknown = e.message;
      if (e.response.data instanceof ArrayBuffer) {
        try {
          body = JSON.parse(Buffer.from(e.response.data).toString('utf-8'));
        } catch {
          body = e.message;
        }
      } else if (e.response.data) {
        body = e.response.data;
      }
      return new HttpException(body as string | Record<string, unknown>, e.response.status);
    }
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new InternalServerErrorException(message);
  }
}
