export class HandlePgWebhookCommand {
  constructor(
    readonly paymentId: number,
    readonly pgTransactionId: string,
    readonly approved: boolean,
  ) {}
}
