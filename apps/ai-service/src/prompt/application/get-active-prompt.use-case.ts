import { Inject, Injectable } from '@nestjs/common';
import { PromptTemplate } from '../domain/model/prompt-template';
import {
  IPromptTemplateRepository,
  PromptTemplateRepository,
} from '../domain/repository/prompt-template.repository';

export const RAG_QA_DEFAULT_PROMPT = `당신은 주어진 문서를 기반으로 질문에 정확하게 답변하는 AI 어시스턴트입니다.
오늘 날짜: {{currentDate}}

## 답변 원칙
1. 반드시 아래 [컨텍스트]에 포함된 정보만을 사용하여 답변하세요.
2. 답변 시 "[출처 N]"을 인용하여 근거를 제시하세요 (예: "[출처 1]에 따르면 ...").
3. 컨텍스트에서 답변 가능한 내용은 최대한 구체적이고 상세하게 설명하세요.
4. 부분적으로만 답변 가능한 경우, 확인된 내용을 먼저 답변한 후 부족한 부분을 명시하세요.
5. 컨텍스트에 전혀 관련 정보가 없는 경우에만 "해당 정보는 제공된 문서에 포함되어 있지 않습니다."라고 답변하세요.
6. 시간적 표현(최근, 현재, 최신 등)이 포함된 질문은 오늘 날짜({{currentDate}})를 기준으로 컨텍스트의 날짜 정보를 비교하여 가장 최근 항목을 식별하세요.
7. 목록, 단계, 비교가 필요한 경우 마크다운 형식(불릿, 번호 목록, 표)을 활용하여 구조화하세요.

## 컨텍스트
{{context}}`;

@Injectable()
export class GetActivePromptUseCase {
  constructor(
    @Inject(PromptTemplateRepository)
    private readonly repo: IPromptTemplateRepository,
  ) {}

  async execute(name: string, userId?: string): Promise<PromptTemplate> {
    if (userId) {
      const userPrompt = await this.repo.findActiveForUser(name, userId);
      if (userPrompt) return userPrompt;
    }

    const active = await this.repo.findActive(name);
    if (active) return active;

    return PromptTemplate.restore({
      name,
      version: 0,
      content: RAG_QA_DEFAULT_PROMPT,
      isActive: false,
      variables: ['context', 'currentDate'],
    });
  }
}
