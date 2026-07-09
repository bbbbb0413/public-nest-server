import { Inject, Injectable } from '@nestjs/common';
import { PromptTemplate } from '../domain/model/prompt-template';
import {
  IPromptTemplateRepository,
  PromptTemplateRepository,
} from '../domain/repository/prompt-template.repository';
import { CreatePromptCommand } from './command/create-prompt.command';

@Injectable()
export class CreatePromptUseCase {
  constructor(
    @Inject(PromptTemplateRepository)
    private readonly repo: IPromptTemplateRepository,
  ) {}

  async execute(command: CreatePromptCommand): Promise<PromptTemplate> {
    const existing = await this.repo.findAllByName(command.name);
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
