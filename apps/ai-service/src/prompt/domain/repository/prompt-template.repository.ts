import { PromptTemplate } from '../model/prompt-template';

export interface IPromptTemplateRepository {
  persist(template: PromptTemplate): Promise<PromptTemplate>;
  findByNameAndVersion(
    name: string,
    version: number,
    userId?: string,
  ): Promise<PromptTemplate | null>;
  findAllByName(name: string, userId?: string): Promise<PromptTemplate[]>;
  findActive(name: string): Promise<PromptTemplate | null>;
  findActiveForUser(
    name: string,
    userId: string,
  ): Promise<PromptTemplate | null>;
  deactivateAllByName(name: string): Promise<void>;
  deactivateAllForUser(name: string, userId: string): Promise<void>;
  deleteByNameAndVersion?(
    name: string,
    version: number,
    userId?: string,
  ): Promise<boolean>;
  update(template: PromptTemplate): Promise<PromptTemplate>;
}

export const PromptTemplateRepository = Symbol('PromptTemplateRepository');

