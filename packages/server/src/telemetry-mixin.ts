import { trace } from '@opentelemetry/api'

const INVALID_TRACE_ID = '00000000000000000000000000000000'

export type TraceMixinFields = {
  traceId?: string
  spanId?: string
}

/**
 * Pino mixin: when an OpenTelemetry span is active on the call stack,
 * attaches traceId + spanId to every log line. When no span is active
 * (or the SDK has not been initialised), returns an empty object.
 */
export function traceMixin(): TraceMixinFields {
  const span = trace.getActiveSpan()
  if (!span) return {}
  const ctx = span.spanContext()
  if (!ctx.traceId || ctx.traceId === INVALID_TRACE_ID) return {}
  return { traceId: ctx.traceId, spanId: ctx.spanId }
}
