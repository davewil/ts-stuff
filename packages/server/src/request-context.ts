import fastifyRequestContext from '@fastify/request-context'
import type { FastifyInstance } from 'fastify'

declare module '@fastify/request-context' {
  interface RequestContextData {
    requestId?: string
  }
}

export async function registerRequestContext(
  app: FastifyInstance,
): Promise<void> {
  await app.register(fastifyRequestContext)
  app.addHook('onRequest', async (req) => {
    req.requestContext.set('requestId', String(req.id))
  })
}

export function getRequestId(): string | undefined {
  return fastifyRequestContext.requestContext.get('requestId')
}

export function getRequestContext():
  | Readonly<Record<string, unknown>>
  | undefined {
  const store = fastifyRequestContext.requestContext.getStore()
  return store as Readonly<Record<string, unknown>> | undefined
}
