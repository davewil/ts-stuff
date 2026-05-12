import { afterEach, describe, it } from 'vitest'
import {
  get_request_id_isolates_per_request,
  get_request_id_returns_bound_value_inside_handler,
  get_request_id_returns_undefined_outside_request,
  stop_request_context_harness,
} from './request-context.steps.ts'

describe('getRequestId', () => {
  afterEach(stop_request_context_harness)

  it('returns the Fastify request id inside a handler', get_request_id_returns_bound_value_inside_handler)
  it('returns distinct ids across concurrent requests', get_request_id_isolates_per_request)
  it('returns undefined when called outside any request', get_request_id_returns_undefined_outside_request)
})
