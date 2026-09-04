import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PromptTemplate } from '../src/prompt/domain/model/prompt-template';
import { CreatePromptUseCase } from '../src/prompt/application/create-prompt.use-case';
import { ActivatePromptUseCase } from '../src/prompt/application/activate-prompt.use-case';
import { GetActivePromptUseCase, RAG_QA_DEFAULT_PROMPT } from '../src/prompt/application/get-active-prompt.use-case';
import { CreatePromptCommand } from '../src/prompt/application/command/create-prompt.command';
import { ActivatePromptCommand } from '../src/prompt/application/command/activate-prompt.command';
import { IPromptTemplateRepository } from '../src/prompt/domain/repository/prompt-template.repository';

class InMemoryPromptTemplateRepository implements IPromptTemplateRepository {
  private templates: PromptTemplate[] = [];

  async persist(template: PromptTemplate): Promise<PromptTemplate> {
    const saved = PromptTemplate.restore({
      id: `id-${this.templates.length + 1}`,
      name: template.name.getValue(),
      version: template.version,
      content: template.content,
      isActive: template.isActive,
      variables: template.variables,
      userId: template.userId,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    });
    this.templates.push(saved);
    return Promise.resolve(saved);
  }

  async findByNameAndVersion(
    name: string,
    version: number,
    userId?: string,
  ): Promise<PromptTemplate | null> {
    const found = this.templates.find((t) => {
      if (t.name.getValue() !== name || t.version !== version) return false;
      if (userId !== undefined) return t.userId === userId;
      return true;
    });
    return Promise.resolve(found || null);
  }

  async findAllByName(name: string, userId?: string): Promise<PromptTemplate[]> {
    const result = this.templates
      .filter((t) => {
        if (t.name.getValue() !== name) return false;
        if (userId !== undefined) {
          return t.userId === userId;
        }
        return t.userId === undefined;
      })
      .sort((a, b) => b.version - a.version);
    return Promise.resolve(result);
  }

  async findActive(name: string): Promise<PromptTemplate | null> {
    const found = this.templates.find(
      (t) => t.name.getValue() === name && t.isActive && !t.userId,
    );
    return Promise.resolve(found || null);
  }

  async findActiveForUser(
    name: string,
    userId: string,
  ): Promise<PromptTemplate | null> {
    const found = this.templates.find(
      (t) => t.name.getValue() === name && t.isActive && t.userId === userId,
    );
    return Promise.resolve(found || null);
  }

  async deactivateAllByName(name: string): Promise<void> {
    this.templates = this.templates.map((t) =>
      t.name.getValue() === name && !t.userId ? t.deactivate() : t,
    );
    return Promise.resolve();
  }

  async deactivateAllForUser(name: string, userId: string): Promise<void> {
    this.templates = this.templates.map((t) =>
      t.name.getValue() === name && t.userId === userId ? t.deactivate() : t,
    );
    return Promise.resolve();
  }

  async deleteByNameAndVersion(
    name: string,
    version: number,
    userId?: string,
  ): Promise<boolean> {
    const initialLen = this.templates.length;
    this.templates = this.templates.filter((t) => {
      if (t.name.getValue() !== name || t.version !== version) return true;
      if (userId !== undefined && t.userId !== userId) return true;
      return false;
    });
    return Promise.resolve(this.templates.length < initialLen);
  }

  async update(template: PromptTemplate): Promise<PromptTemplate> {
    const index = this.templates.findIndex(
      (t) => t.id === template.id || (t.name.getValue() === template.name.getValue() && t.version === template.version && t.userId === template.userId),
    );
    if (index !== -1) {
      this.templates[index] = template;
    }
    return Promise.resolve(template);
  }
}


describe('다중 슬롯 개인 시스템 프롬프트 관리 및 소유권 격리', () => {
  let repo: InMemoryPromptTemplateRepository;
  let createUseCase: CreatePromptUseCase;
  let activateUseCase: ActivatePromptUseCase;
  let getActiveUseCase: GetActivePromptUseCase;

  beforeEach(() => {
    repo = new InMemoryPromptTemplateRepository();
    createUseCase = new CreatePromptUseCase(repo);
    activateUseCase = new ActivatePromptUseCase(repo);
    getActiveUseCase = new GetActivePromptUseCase(repo);
  });

  describe('프롬프트 다중 슬롯 생성 및 10개 제한', () => {
    it('개인 프롬프트를 최대 10개까지 저장할 수 있다', async () => {
      for (let i = 1; i <= 10; i++) {
        const prompt = await createUseCase.execute(
          new CreatePromptCommand('rag-qa-system', `프롬프트 ${i}`, ['context'], 'user-1'),
        );
        expect(prompt.version).toBe(i);
        expect(prompt.userId).toBe('user-1');
      }

      const list = await repo.findAllByName('rag-qa-system', 'user-1');
      expect(list).toHaveLength(10);
    });

    it('개인 프롬프트가 이미 10개인 경우 추가 생성 시 BadRequestException을 던진다', async () => {
      for (let i = 1; i <= 10; i++) {
        await createUseCase.execute(
          new CreatePromptCommand('rag-qa-system', `프롬프트 ${i}`, ['context'], 'user-1'),
        );
      }

      await expect(
        createUseCase.execute(
          new CreatePromptCommand('rag-qa-system', '11번째 프롬프트', ['context'], 'user-1'),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('소유권 격리 및 보안 검증', () => {
    it('목록 조회 시 다른 사용자의 개인 프롬프트가 노출되지 않는다', async () => {
      await createUseCase.execute(
        new CreatePromptCommand('rag-qa-system', '유저1 프롬프트', ['context'], 'user-1'),
      );
      await createUseCase.execute(
        new CreatePromptCommand('rag-qa-system', '유저2 프롬프트', ['context'], 'user-2'),
      );

      const user1List = await repo.findAllByName('rag-qa-system', 'user-1');
      expect(user1List).toHaveLength(1);
      expect(user1List[0].userId).toBe('user-1');
      expect(user1List[0].content).toBe('유저1 프롬프트');

      const user2List = await repo.findAllByName('rag-qa-system', 'user-2');
      expect(user2List).toHaveLength(1);
      expect(user2List[0].userId).toBe('user-2');
      expect(user2List[0].content).toBe('유저2 프롬프트');
    });

    it('타인의 개인 프롬프트는 활성화할 수 없다', async () => {
      const p1 = await createUseCase.execute(
        new CreatePromptCommand('rag-qa-system', '유저1 프롬프트', ['context'], 'user-1'),
      );

      await expect(
        activateUseCase.execute(
          new ActivatePromptCommand('rag-qa-system', p1.version, 'user-2'),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('활성화 및 우선순위 규칙', () => {
    it('사용자가 특정 슬롯을 활성화하면 해당 프롬프트가 적용된다', async () => {
      await createUseCase.execute(
        new CreatePromptCommand('rag-qa-system', '프롬프트 1', ['context'], 'user-1'),
      );
      const p2 = await createUseCase.execute(
        new CreatePromptCommand('rag-qa-system', '프롬프트 2', ['context'], 'user-1'),
      );


      await activateUseCase.execute(
        new ActivatePromptCommand('rag-qa-system', p2.version, 'user-1'),
      );

      const active = await getActiveUseCase.execute('rag-qa-system', 'user-1');
      expect(active.version).toBe(p2.version);
      expect(active.content).toBe('프롬프트 2');
    });

    it('새 프롬프트를 활성화하면 기존에 활성화되어 있던 프롬프트는 비활성화된다', async () => {
      const p1 = await createUseCase.execute(
        new CreatePromptCommand('rag-qa-system', '프롬프트 1', ['context'], 'user-1'),
      );
      const p2 = await createUseCase.execute(
        new CreatePromptCommand('rag-qa-system', '프롬프트 2', ['context'], 'user-1'),
      );

      await activateUseCase.execute(
        new ActivatePromptCommand('rag-qa-system', p1.version, 'user-1'),
      );
      await activateUseCase.execute(
        new ActivatePromptCommand('rag-qa-system', p2.version, 'user-1'),
      );

      const list = await repo.findAllByName('rag-qa-system', 'user-1');
      const activePrompts = list.filter((p) => p.isActive);
      expect(activePrompts).toHaveLength(1);
      expect(activePrompts[0].version).toBe(p2.version);
    });

    it('활성 프롬프트를 비활성화하거나 삭제하면 기본값(또는 전역 활성값)으로 자동 전환된다', async () => {
      const p1 = await createUseCase.execute(
        new CreatePromptCommand('rag-qa-system', '프롬프트 1', ['context'], 'user-1'),
      );
      await activateUseCase.execute(
        new ActivatePromptCommand('rag-qa-system', p1.version, 'user-1'),
      );

      // 활성 상태 확인
      let current = await getActiveUseCase.execute('rag-qa-system', 'user-1');
      expect(current.content).toBe('프롬프트 1');

      // 비활성화
      await repo.deactivateAllForUser('rag-qa-system', 'user-1');

      // 기본값 폴백 확인
      current = await getActiveUseCase.execute('rag-qa-system', 'user-1');
      expect(current.content).toBe(RAG_QA_DEFAULT_PROMPT);
      expect(current.version).toBe(0);
    });
  });
});
