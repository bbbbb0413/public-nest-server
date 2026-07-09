import { AggregateRoot } from '@libs/shared-kernel';
import { PromptName } from '../vo/prompt-name.vo';

export interface PromptTemplateProps {
  id?: string;
  name: string;
  version: number;
  content: string;
  isActive: boolean;
  variables: string[];
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PromptTemplate extends AggregateRoot {
  private constructor(
    readonly id: string | undefined,
    readonly name: PromptName,
    readonly version: number,
    readonly content: string,
    readonly isActive: boolean,
    readonly variables: string[],
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly userId?: string,
  ) {
    super();
  }

  static create(props: {
    name: string;
    content: string;
    variables?: string[];
    version?: number;
    userId?: string;
  }): PromptTemplate {
    const now = new Date();
    return new PromptTemplate(
      undefined,
      PromptName.of(props.name),
      props.version ?? 1,
      props.content,
      false,
      props.variables ?? [],
      now,
      now,
      props.userId,
    );
  }

  static restore(props: PromptTemplateProps): PromptTemplate {
    const now = new Date();
    return new PromptTemplate(
      props.id,
      PromptName.of(props.name),
      props.version,
      props.content,
      props.isActive,
      props.variables,
      props.createdAt ?? now,
      props.updatedAt ?? now,
      props.userId,
    );
  }

  activate(): PromptTemplate {
    return PromptTemplate.restore({
      id: this.id,
      name: this.name.getValue(),
      version: this.version,
      content: this.content,
      isActive: true,
      variables: this.variables,
      userId: this.userId,
      createdAt: this.createdAt,
      updatedAt: new Date(),
    });
  }

  deactivate(): PromptTemplate {
    return PromptTemplate.restore({
      id: this.id,
      name: this.name.getValue(),
      version: this.version,
      content: this.content,
      isActive: false,
      variables: this.variables,
      userId: this.userId,
      createdAt: this.createdAt,
      updatedAt: new Date(),
    });
  }

  render(variables: Record<string, string>): string {
    return Object.entries(variables).reduce(
      (acc, [key, val]) => acc.replaceAll(`{{${key}}}`, val),
      this.content,
    );
  }
}
