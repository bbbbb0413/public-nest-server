export const GEN_AI = {
  REQUEST_MODEL: 'gen_ai.request.model',
  TOKEN_USAGE: 'gen_ai.client.token.usage',
  OPERATION_DURATION: 'gen_ai.client.operation.duration',
  OPERATION_NAME: 'gen_ai.operation.name',
} as const;

export const RAG = {
  RETRIEVAL_EMPTY: 'rag.retrieval.empty_result',
  CONTEXT_TRUNCATED: 'rag.context.truncated',
  RERANK_APPLIED: 'rag.rerank.applied',
  AGENT_ITERATION: 'agent.iteration',
} as const;
