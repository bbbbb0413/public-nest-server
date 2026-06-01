export class CreatePaymentCommand {
  constructor(
    readonly userId: number,
    readonly amount: number,
    readonly currency: string,
    readonly paymentMethod: string,
    readonly productId: string,
    readonly quantity: string,
  ) {}
}
