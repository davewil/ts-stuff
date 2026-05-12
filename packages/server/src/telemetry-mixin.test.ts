import { afterAll, beforeAll, describe, it } from 'vitest'
import {
  setup_tracer_provider,
  teardown_tracer_provider,
  trace_mixin_returns_empty_after_span_ends,
  trace_mixin_returns_empty_when_no_active_span,
  trace_mixin_returns_trace_and_span_ids_inside_active_span,
} from './telemetry-mixin.steps.ts'

describe('traceMixin', () => {
  beforeAll(setup_tracer_provider)
  afterAll(teardown_tracer_provider)

  it('returns {} when no span is active', trace_mixin_returns_empty_when_no_active_span)
  it('returns traceId + spanId inside an active span', trace_mixin_returns_trace_and_span_ids_inside_active_span)
  it('returns {} once the span has ended', trace_mixin_returns_empty_after_span_ends)
})
