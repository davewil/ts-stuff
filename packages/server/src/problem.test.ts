import { describe, it } from 'vitest'
import {
  problem_for_handles_non_error_throwables,
  problem_for_maps_other_4xx_to_bad_request,
  problem_for_maps_status_404_to_not_found,
  problem_for_maps_unknown_to_internal_error,
  problem_schema_accepts_valid_envelope,
  problem_schema_rejects_out_of_range_status,
} from './problem.steps.ts'

describe('ProblemSchema', () => {
  it('accepts a valid envelope', problem_schema_accepts_valid_envelope)
  it('rejects out-of-range status codes', problem_schema_rejects_out_of_range_status)
})

describe('problemFor', () => {
  it('maps unknown errors to internal_error', problem_for_maps_unknown_to_internal_error)
  it('maps statusCode 404 to not_found', problem_for_maps_status_404_to_not_found)
  it('maps other 4xx statuses to bad_request', problem_for_maps_other_4xx_to_bad_request)
  it('handles non-Error throwables', problem_for_handles_non_error_throwables)
})
