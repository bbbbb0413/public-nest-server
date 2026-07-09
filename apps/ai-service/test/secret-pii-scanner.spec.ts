import { SecretPiiScanner } from '../src/qa/application/filter/secret-pii-scanner';

describe('SecretPiiScanner', () => {
  let scanner: SecretPiiScanner;

  beforeEach(() => {
    scanner = new SecretPiiScanner();
  });

  describe('mask', () => {
    it('OpenAI API 키 패턴을 마스킹한다', () => {
      // Arrange
      const text = 'my key is sk-abcdEFGH1234567890abcdEFGH and it works';

      // Act
      const masked = scanner.mask(text);

      // Assert
      expect(masked).not.toContain('sk-abcdEFGH1234567890abcdEFGH');
      expect(masked).toContain('[REDACTED_OPENAI_API_KEY]');
    });

    it('AWS Access Key 패턴을 마스킹한다', () => {
      // Arrange
      const text = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';

      // Act
      const masked = scanner.mask(text);

      // Assert
      expect(masked).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(masked).toContain('[REDACTED_AWS_ACCESS_KEY]');
    });

    it('JWT 토큰 패턴을 마스킹한다', () => {
      // Arrange
      const text =
        'token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dGVzdHNpZ25hdHVyZQ';

      // Act
      const masked = scanner.mask(text);

      // Assert
      expect(masked).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      expect(masked).toContain('[REDACTED_JWT]');
    });

    it('Bearer 토큰 패턴을 마스킹한다', () => {
      // Arrange
      const text = 'Authorization: Bearer abcdef1234567890ZYXWVU';

      // Act
      const masked = scanner.mask(text);

      // Assert
      expect(masked).not.toContain('abcdef1234567890ZYXWVU');
      expect(masked).toContain('[REDACTED_BEARER_TOKEN]');
    });

    it('PEM 형식의 개인키 블록을 마스킹한다', () => {
      // Arrange
      const text = [
        '-----BEGIN RSA PRIVATE KEY-----',
        'MIIBVQIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEAuiNQHzZQzZpZ',
        '-----END RSA PRIVATE KEY-----',
      ].join('\n');

      // Act
      const masked = scanner.mask(text);

      // Assert
      expect(masked).not.toContain(
        'MIIBVQIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEAuiNQHzZQzZpZ',
      );
      expect(masked).toContain('[REDACTED_PRIVATE_KEY]');
    });

    it('이메일 주소 패턴을 마스킹한다', () => {
      // Arrange
      const text = '문의사항은 user@example.com 으로 보내주세요.';

      // Act
      const masked = scanner.mask(text);

      // Assert
      expect(masked).not.toContain('user@example.com');
      expect(masked).toContain('[REDACTED_EMAIL]');
    });

    it('한국 주민등록번호 패턴을 마스킹한다', () => {
      // Arrange
      const text = '주민등록번호: 901231-1234567';

      // Act
      const masked = scanner.mask(text);

      // Assert
      expect(masked).not.toContain('901231-1234567');
      expect(masked).toContain('[REDACTED_KR_RRN]');
    });

    it('한국 휴대폰 번호 패턴을 마스킹한다', () => {
      // Arrange
      const text = '연락처: 010-1234-5678';

      // Act
      const masked = scanner.mask(text);

      // Assert
      expect(masked).not.toContain('010-1234-5678');
      expect(masked).toContain('[REDACTED_KR_PHONE]');
    });

    it('민감 정보가 없는 텍스트는 그대로 반환한다', () => {
      // Arrange
      const text = '환불 정책은 7일 이내 가능합니다.';

      // Act
      const masked = scanner.mask(text);

      // Assert
      expect(masked).toBe(text);
    });
  });

  describe('containsSensitiveData', () => {
    it('시크릿 패턴이 포함된 텍스트는 true를 반환한다', () => {
      // Arrange
      const text = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';

      // Act
      const result = scanner.containsSensitiveData(text);

      // Assert
      expect(result).toBe(true);
    });

    it('민감 정보가 없는 텍스트는 false를 반환한다', () => {
      // Arrange
      const text = '환불 정책은 7일 이내 가능합니다.';

      // Act
      const result = scanner.containsSensitiveData(text);

      // Assert
      expect(result).toBe(false);
    });
  });
});
