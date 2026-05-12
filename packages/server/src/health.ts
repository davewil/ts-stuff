import { z } from 'zod'
import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod'

const HealthResponseSchema = z.object({
  status: z.literal('ok'),
})

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        response: { 200: HealthResponseSchema },
      },
    },
    async () => ({ status: 'ok' as const }),
  )
}
