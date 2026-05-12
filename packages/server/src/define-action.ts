import type {
  FastifyReply,
  FastifyRequest,
  FastifySchema,
  HTTPMethods,
} from 'fastify'
import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod'

export type ActionContext<TBody, TParams, TQuery> = {
  body: TBody
  params: TParams
  query: TQuery
  req: FastifyRequest
  reply: FastifyReply
}

export type ActionConfig<TBody, TParams, TQuery> = {
  method: HTTPMethods
  url: string
  schema: FastifySchema
  handler: (
    ctx: ActionContext<TBody, TParams, TQuery>,
  ) => Promise<unknown> | unknown
}

export function defineAction<
  TBody = unknown,
  TParams = unknown,
  TQuery = unknown,
>(
  config: ActionConfig<TBody, TParams, TQuery>,
): FastifyPluginAsyncZod {
  return async (app) => {
    app.route({
      method: config.method,
      url: config.url,
      schema: config.schema,
      handler: async (req, reply) =>
        config.handler({
          body: req.body as TBody,
          params: req.params as TParams,
          query: req.query as TQuery,
          req,
          reply,
        }),
    })
  }
}
