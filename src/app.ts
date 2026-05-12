import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'
import type { FastifySchemaValidationError } from 'fastify/types/schema.d.ts'
import sensible from '@fastify/sensible'
import helmet from '@fastify/helmet'
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod'
import type { Problem } from './contracts/index.ts'
import type { TaskDeps } from './domain/tasks.ts'
import { healthRoutes } from './routes/health.ts'
import { taskRoutes } from './routes/tasks.ts'

export type AppOptions = {
  taskDeps: TaskDeps
  loggerEnabled?: boolean
}

const PROBLEM_CONTENT_TYPE = 'application/problem+json'

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

function problemFor(err: unknown): { status: number; body: Problem } {
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

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.loggerEnabled ?? false,
    disableRequestLogging: true,
  }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  await app.register(sensible)
  await app.register(helmet)

  app.setErrorHandler((err, _req, reply) => {
    const { status, body } = problemFor(err)
    reply.code(status).type(PROBLEM_CONTENT_TYPE).send(body)
  })

  app.setNotFoundHandler((req, reply) => {
    const body: Problem = {
      type: 'route_not_found',
      title: 'route not found',
      status: 404,
      detail: `no route for ${req.method} ${req.url}`,
    }
    reply.code(404).type(PROBLEM_CONTENT_TYPE).send(body)
  })

  await app.register(healthRoutes)
  await app.register(taskRoutes, { deps: opts.taskDeps })

  await app.ready()
  return app
}
