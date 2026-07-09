import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { ExfiltrationInterceptor } from '../src/qa/presentation/interceptor/exfiltration.interceptor';
import { SecretPiiScanner } from '../src/qa/application/filter/secret-pii-scanner';

describe('ExfiltrationInterceptor', () => {
  let interceptor: ExfiltrationInterceptor;
  let scanner: SecretPiiScanner;

  const dummyContext = {} as ExecutionContext;

  const createCallHandler = (returnValue: unknown): CallHandler => ({
    handle: () => of(returnValue),
  });

  beforeEach(() => {
    scanner = new SecretPiiScanner();
    interceptor = new ExfiltrationInterceptor(scanner);
  });

  it('문자열 응답에 포함된 이메일을 마스킹한다', (done) => {
    // Arrange
    const handler = createCallHandler(
      '문의: user@example.com 으로 연락주세요.',
    );

    // Act
    interceptor.intercept(dummyContext, handler).subscribe((result) => {
      // Assert
      expect(result).not.toContain('user@example.com');
      expect(result).toContain('[REDACTED_EMAIL]');
      done();
    });
  });

  it('객체 응답의 문자열 필드에 포함된 API 키를 마스킹한다', (done) => {
    // Arrange
    const handler = createCallHandler({
      text: 'my key is sk-abcdEFGH1234567890abcdEFGH',
    });

    // Act
    interceptor
      .intercept(dummyContext, handler)
      .subscribe((result: { text: string }) => {
        // Assert
        expect(result.text).not.toContain('sk-abcdEFGH1234567890abcdEFGH');
        expect(result.text).toContain('[REDACTED_OPENAI_API_KEY]');
        done();
      });
  });

  it('배열 응답 내 각 요소의 문자열 필드를 마스킹한다', (done) => {
    // Arrange
    const handler = createCallHandler([
      { text: 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE' },
      { text: '정상 텍스트입니다.' },
    ]);

    // Act
    interceptor
      .intercept(dummyContext, handler)
      .subscribe((result: Array<{ text: string }>) => {
        // Assert
        expect(result[0].text).toContain('[REDACTED_AWS_ACCESS_KEY]');
        expect(result[1].text).toBe('정상 텍스트입니다.');
        done();
      });
  });

  it('민감 정보가 없는 응답은 그대로 통과시킨다', (done) => {
    // Arrange
    const data = { text: '환불 정책은 7일 이내 가능합니다.' };
    const handler = createCallHandler(data);

    // Act
    interceptor.intercept(dummyContext, handler).subscribe((result) => {
      // Assert
      expect(result).toEqual(data);
      done();
    });
  });
});
