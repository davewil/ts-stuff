import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions'
import {
  ConsoleSpanExporter,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-base'

const otlpEndpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT']
const serviceName = process.env['OTEL_SERVICE_NAME'] ?? 'node-ts-test-api'
const serviceVersion = process.env['OTEL_SERVICE_VERSION'] ?? '0.0.0'

const traceExporter: SpanExporter = otlpEndpoint
  ? new OTLPTraceExporter({ url: `${otlpEndpoint.replace(/\/$/, '')}/v1/traces` })
  : new ConsoleSpanExporter()

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
  }),
  traceExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      // The fs instrumentation produces enormous span volume; off by default.
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
})

sdk.start()

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    try {
      await sdk.shutdown()
    } catch {
      // best-effort flush; falls through to the process exit handlers
    }
  })
}
