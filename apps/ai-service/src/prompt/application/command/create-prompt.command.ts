export class CreatePromptCommand {
  constructor(
    readonly name: string,
    readonly content: string,
    readonly variables: string[],
    readonly userId?: string,
  ) {}
}
