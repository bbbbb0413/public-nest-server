import { of, throwError } from 'rxjs';
import { AxiosError, AxiosHeaders } from 'axios';
import { AiServicePyHttpService } from './ai-service-py-http.service';

describe('AiServicePyHttpService', () => {
  let mockHttpService: any;
  let service: AiServicePyHttpService;

  beforeEach(() => {
    mockHttpService = { get: jest.fn() };
    service = new AiServicePyHttpService(mockHttpService);
  });

  describe('getBinary', () => {
    it('바이너리 데이터와 content-type/content-disposition 헤더를 그대로 반환한다', async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: new TextEncoder().encode('hello world').buffer,
          headers: {
            'content-type': 'text/plain',
            'content-disposition': 'inline; filename="a.txt"',
          },
        }),
      );

      const result = await service.getBinary('knowledge/documents/doc-1/file');

      expect(result.data.toString('utf-8')).toBe('hello world');
      expect(result.contentType).toBe('text/plain');
      expect(result.contentDisposition).toBe('inline; filename="a.txt"');
      expect(mockHttpService.get).toHaveBeenCalledWith(
        'http://ai-service-py:3004/knowledge/documents/doc-1/file',
        { responseType: 'arraybuffer' },
      );
    });

    it('content-type이 없으면 application/octet-stream으로 기본값을 채운다', async () => {
      mockHttpService.get.mockReturnValue(
        of({ data: new ArrayBuffer(0), headers: {} }),
      );

      const result = await service.getBinary('knowledge/documents/doc-1/file');

      expect(result.contentType).toBe('application/octet-stream');
      expect(result.contentDisposition).toBeUndefined();
    });

    it('404 응답의 JSON 본문(ArrayBuffer로 온)을 디코드해 HttpException으로 던진다', async () => {
      const errorBody = JSON.stringify({ detail: '원본 파일을 찾을 수 없습니다: doc-missing' });
      const axiosError = new AxiosError(
        'Request failed with status code 404',
        '404',
        undefined,
        undefined,
        {
          status: 404,
          statusText: 'Not Found',
          headers: new AxiosHeaders(),
          config: { headers: new AxiosHeaders() } as any,
          data: new TextEncoder().encode(errorBody).buffer,
        },
      );
      mockHttpService.get.mockReturnValue(throwError(() => axiosError));

      try {
        await service.getBinary('knowledge/documents/doc-missing/file');
        fail('예외가 발생해야 한다');
      } catch (e: any) {
        expect(e.getStatus()).toBe(404);
        expect(e.getResponse()).toEqual({ detail: '원본 파일을 찾을 수 없습니다: doc-missing' });
      }
    });
  });
});
