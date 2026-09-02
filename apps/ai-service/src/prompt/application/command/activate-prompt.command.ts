export class ActivatePromptCommand {
  constructor(
    readonly name: string,
    readonly version: number,
    readonly userId?: string,
  ) {}
}

