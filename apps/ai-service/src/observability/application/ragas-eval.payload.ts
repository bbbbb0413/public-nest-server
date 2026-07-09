export interface RagasEvalPayload {
  traceId: string;
  question: string;
  answer: string;
  contexts: string[];
}
