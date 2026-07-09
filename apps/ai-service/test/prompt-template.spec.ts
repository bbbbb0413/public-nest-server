import { PromptTemplate } from '../src/prompt/domain/model/prompt-template';
import { PromptName } from '../src/prompt/domain/vo/prompt-name.vo';

describe('PromptName VO', () => {
  it('유효한 이름을 생성한다', () => {
    const name = PromptName.of('rag-qa-system');
    expect(name.getValue()).toBe('rag-qa-system');
  });

  it('빈 이름은 예외를 던진다', () => {
    expect(() => PromptName.of('')).toThrow('비어있을 수 없습니다');
  });

  it('대문자가 포함된 이름은 예외를 던진다', () => {
    expect(() => PromptName.of('Rag-QA')).toThrow('소문자, 숫자, 하이픈');
  });

  it('공백이 포함된 이름은 예외를 던진다', () => {
    expect(() => PromptName.of('rag qa')).toThrow('소문자, 숫자, 하이픈');
  });
});

describe('PromptTemplate 도메인 모델', () => {
  describe('create()', () => {
    it('기본 버전 1로 비활성 상태의 템플릿을 생성한다', () => {
      const template = PromptTemplate.create({
        name: 'rag-qa-system',
        content: '컨텍스트: {{context}}',
        variables: ['context'],
      });

      expect(template.id).toBeUndefined();
      expect(template.name.getValue()).toBe('rag-qa-system');
      expect(template.version).toBe(1);
      expect(template.isActive).toBe(false);
      expect(template.variables).toEqual(['context']);
    });

    it('version 옵션을 지정하면 해당 버전으로 생성한다', () => {
      const template = PromptTemplate.create({
        name: 'test',
        content: '내용',
        version: 3,
      });
      expect(template.version).toBe(3);
    });
  });

  describe('render()', () => {
    it('변수를 치환하여 프롬프트 문자열을 반환한다', () => {
      const template = PromptTemplate.create({
        name: 'rag-qa-system',
        content: '컨텍스트:\n{{context}}\n질문: {{question}}',
        variables: ['context', 'question'],
      });

      const result = template.render({
        context: '관련 문서 내용',
        question: '이게 뭔가요?',
      });

      expect(result).toBe('컨텍스트:\n관련 문서 내용\n질문: 이게 뭔가요?');
    });

    it('동일 변수가 여러 번 등장해도 모두 치환한다', () => {
      const template = PromptTemplate.create({
        name: 'test',
        content: '{{context}} 그리고 {{context}}',
        variables: ['context'],
      });

      const result = template.render({ context: 'ABC' });
      expect(result).toBe('ABC 그리고 ABC');
    });

    it('매핑되지 않은 변수는 그대로 남긴다', () => {
      const template = PromptTemplate.create({
        name: 'test',
        content: '{{context}} 와 {{other}}',
        variables: ['context'],
      });

      const result = template.render({ context: 'ABC' });
      expect(result).toBe('ABC 와 {{other}}');
    });
  });

  describe('activate() / deactivate()', () => {
    it('activate()는 isActive가 true인 새 인스턴스를 반환한다', () => {
      const template = PromptTemplate.create({ name: 'test', content: '내용' });
      expect(template.isActive).toBe(false);

      const activated = template.activate();
      expect(activated.isActive).toBe(true);
      expect(template.isActive).toBe(false); // 원본 불변
    });

    it('deactivate()는 isActive가 false인 새 인스턴스를 반환한다', () => {
      const template = PromptTemplate.restore({
        name: 'test',
        version: 1,
        content: '내용',
        isActive: true,
        variables: [],
      });

      const deactivated = template.deactivate();
      expect(deactivated.isActive).toBe(false);
      expect(template.isActive).toBe(true); // 원본 불변
    });
  });
});
