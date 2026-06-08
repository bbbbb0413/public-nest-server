export class AskCommand {
  constructor(
    readonly question: string,
    readonly topK: number = 5,
  ) {}
}
