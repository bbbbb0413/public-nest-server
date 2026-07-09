import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

let sdk: NodeSDK | null = null;

export function initOtelGenai(): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    return;
  }

  const exporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` });
  sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'ai-service',
    traceExporter: exporter,
  });

  sdk.start();
}

export async function shutdownOtelGenai(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}
