import { afterAll, beforeAll, expect } from 'vitest'
import { context, trace } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { traceMixin } from './telemetry-mixin.ts'

let exporter: InMemorySpanExporter
let provider: BasicTracerProvider
let contextManager: AsyncLocalStorageContextManager

export function setup_tracer_provider(): void {
  contextManager = new AsyncLocalStorageContextManager()
  contextManager.enable()
  context.setGlobalContextManager(contextManager)
  exporter = new InMemorySpanExporter()
  provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  })
  trace.setGlobalTracerProvider(provider)
}

export async function teardown_tracer_provider(): Promise<void> {
  trace.disable()
  context.disable()
  contextManager.disable()
  await provider.shutdown()
  exporter.reset()
}

export { beforeAll, afterAll }

export function trace_mixin_returns_empty_when_no_active_span(): void {
  expect(traceMixin()).toEqual({})
}

export function trace_mixin_returns_trace_and_span_ids_inside_active_span(): void {
  const tracer = trace.getTracer('test')
  tracer.startActiveSpan('work', (span) => {
    const fields = traceMixin()
    expect(fields.traceId).toMatch(/^[0-9a-f]{32}$/)
    expect(fields.spanId).toMatch(/^[0-9a-f]{16}$/)
    expect(fields.traceId).toBe(span.spanContext().traceId)
    expect(fields.spanId).toBe(span.spanContext().spanId)
    span.end()
  })
}

export function trace_mixin_returns_empty_after_span_ends(): void {
  const tracer = trace.getTracer('test')
  tracer.startActiveSpan('work', (span) => span.end())
  expect(traceMixin()).toEqual({})
}
