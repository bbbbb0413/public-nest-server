export class HybridSearchCommand {
  constructor(
    readonly question: string,
    readonly topK: number = 5,
    readonly useHyde: boolean = false,
  ) {}
}
