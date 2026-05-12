import { expect } from 'vitest'
import { problemFor, ProblemSchema } from './problem.ts'

export function problem_schema_accepts_valid_envelope(): void {
  const parsed = ProblemSchema.parse({
    type: 'invalid_body',
    title: 'invalid body',
    status: 400,
    detail: 'title is required',
  })
  expect(parsed.type).toBe('invalid_body')
}

export function problem_schema_rejects_out_of_range_status(): void {
  expect(() =>
    ProblemSchema.parse({
      type: 'oops',
      title: 'oops',
      status: 99,
    }),
  ).toThrow()
}

export function problem_for_maps_unknown_to_internal_error(): void {
  const { status, body } = problemFor(new Error('boom'))
  expect(status).toBe(500)
  expect(body.type).toBe('internal_error')
  expect(body.detail).toBe('boom')
}

export function problem_for_maps_status_404_to_not_found(): void {
  const err = Object.assign(new Error('missing'), { statusCode: 404 })
  const { status, body } = problemFor(err)
  expect(status).toBe(404)
  expect(body.type).toBe('not_found')
  expect(body.detail).toBe('missing')
}

export function problem_for_maps_other_4xx_to_bad_request(): void {
  const err = Object.assign(new Error('unauthorized'), { statusCode: 401 })
  const { status, body } = problemFor(err)
  expect(status).toBe(401)
  expect(body.type).toBe('bad_request')
}

export function problem_for_handles_non_error_throwables(): void {
  const { status, body } = problemFor('a bare string')
  expect(status).toBe(500)
  expect(body.type).toBe('internal_error')
  expect(body.detail).toBe('unknown error')
}
