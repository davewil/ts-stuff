import Fastify, { type FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import helmet from '@fastify/helmet'
import {
  serializerCompiler,
  validatorCompiler,
  type FastifyPluginAsyncZod,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod'
import { healthRoutes } from './health.ts'
import type { LoggerOption } from './logger.ts'
import { PROBLEM_CONTENT_TYPE, problemFor, type Problem } from './problem.ts'
import { registerRequestContext } from './request-context.ts'

export type BuildAppOptions = {
  routes?: readonly FastifyPluginAsyncZod[]
  logger?: LoggerOption
  mountHealth?: boolean
}

export async function buildApp(
  opts: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? false,
  }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  await app.register(sensible)
  await app.register(helmet)
  await registerRequestContext(app)

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

  if (opts.mountHealth !== false) {
    await app.register(healthRoutes)
  }

  for (const route of opts.routes ?? []) {
    await app.register(route)
  }

  await app.ready()
  return app
}
