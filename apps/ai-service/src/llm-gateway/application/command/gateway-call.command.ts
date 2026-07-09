import { LlmMessage } from '@libs/llm';

export class GatewayCallCommand {
  constructor(
    readonly messages: LlmMessage[],
    readonly feature: string,
    readonly tenant: string,
    readonly preferredModel?: string,
  ) {}
}
