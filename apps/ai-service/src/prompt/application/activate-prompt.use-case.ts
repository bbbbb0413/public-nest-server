import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PromptTemplate } from '../domain/model/prompt-template';
import {
  IPromptTemplateRepository,
  PromptTemplateRepository,
} from '../domain/repository/prompt-template.repository';
import { ActivatePromptCommand } from './command/activate-prompt.command';

@Injectable()
export class ActivatePromptUseCase {
  constructor(
    @Inject(PromptTemplateRepository)
    private readonly repo: IPromptTemplateRepository,
  ) {}

  async execute(command: ActivatePromptCommand): Promise<PromptTemplate> {
    const target = await this.repo.findByNameAndVersion(
      command.name,
      command.version,
    );
    if (!target) {
      throw new NotFoundException(
        `프롬프트를 찾을 수 없습니다: ${command.name} v${command.version}`,
      );
    }

    await this.repo.deactivateAllByName(command.name);
    const activated = target.activate();
    return this.repo.update(activated);
  }
}
