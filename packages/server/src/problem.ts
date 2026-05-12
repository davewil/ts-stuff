import { z } from 'zod'
import type { FastifyError } from 'fastify'
import type { FastifySchemaValidationError } from 'fastify/types/schema.d.ts'
import { hasZodFastifySchemaValidationErrors } from '@fastify/type-provider-zod'

export const ProblemSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  status: z.number().int().min(100).max(599),
  detail: z.string().optional(),
})
export type Problem = z.infer<typeof ProblemSchema>

export const PROBLEM_CONTENT_TYPE = 'application/problem+json'

function detailFromValidation(
  validation: readonly FastifySchemaValidationError[],
): string {
  return validation
    .map((v) => {
      const path = (v.instancePath ?? '').replace(/^\//, '').replace(/\//g, '.')
      const message = v.message ?? 'invalid'
      return path ? `${path}: ${message}` : message
    })
    .join('; ')
}

export function problemFor(err: unknown): { status: number; body: Problem } {
  if (hasZodFastifySchemaValidationErrors(err)) {
    return {
      status: 400,
      body: {
        type: 'invalid_body',
        title: 'invalid body',
        status: 400,
        detail: detailFromValidation(err.validation),
      },
    }
  }

  const fe = err as FastifyError
  const message = typeof fe?.message === 'string' ? fe.message : 'unknown error'

  if (fe?.code === 'FST_ERR_CTP_INVALID_JSON_BODY') {
    return {
      status: 400,
      body: {
        type: 'invalid_json',
        title: 'invalid json',
        status: 400,
        detail: 'body is not valid JSON',
      },
    }
  }

  const status = fe?.statusCode ?? 500
  if (status === 404) {
    return {
      status,
      body: { type: 'not_found', title: 'not found', status, detail: message },
    }
  }
  if (status >= 400 && status < 500) {
    return {
      status,
      body: { type: 'bad_request', title: 'bad request', status, detail: message },
    }
  }
  return {
    status: 500,
    body: {
      type: 'internal_error',
      title: 'internal error',
      status: 500,
      detail: message,
    },
  }
}
