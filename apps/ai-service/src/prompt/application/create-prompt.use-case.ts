import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PromptTemplate } from '../domain/model/prompt-template';
import {
  IPromptTemplateRepository,
  PromptTemplateRepository,
} from '../domain/repository/prompt-template.repository';
import { CreatePromptCommand } from './command/create-prompt.command';

const MAX_USER_PROMPT_SLOTS = 10;

@Injectable()
export class CreatePromptUseCase {
  constructor(
    @Inject(PromptTemplateRepository)
    private readonly repo: IPromptTemplateRepository,
  ) {}

  async execute(command: CreatePromptCommand): Promise<PromptTemplate> {
    const existing = await this.repo.findAllByName(
      command.name,
      command.userId,
    );

    if (command.userId && existing.length >= MAX_USER_PROMPT_SLOTS) {
      throw new BadRequestException(
        `개인 프롬프트는 최대 ${MAX_USER_PROMPT_SLOTS}개까지 저장할 수 있습니다.`,
      );
    }

    const nextVersion =
      existing.length > 0 ? Math.max(...existing.map((t) => t.version)) + 1 : 1;

    const template = PromptTemplate.create({
      name: command.name,
      content: command.content,
      variables: command.variables,
      version: nextVersion,
      userId: command.userId,
    });

    return this.repo.persist(template);
  }
}

