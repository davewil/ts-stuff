import { z } from 'zod'
import { defineAction } from '@app/server'
import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod'
import {
  CreateTaskInputSchema,
  TaskIdSchema,
  TaskSchema,
  type CreateTaskInput,
} from '../contracts/index.ts'
import { createTask, getTask, type TaskDeps } from '../domain/tasks.ts'

const GetTaskParamsSchema = z.object({
  id: TaskIdSchema,
})

type GetTaskParams = z.infer<typeof GetTaskParamsSchema>

export function makeTaskRoutes(deps: TaskDeps): FastifyPluginAsyncZod {
  return async (app) => {
    await app.register(
      defineAction<CreateTaskInput>({
        method: 'POST',
        url: '/tasks',
        schema: {
          body: CreateTaskInputSchema,
          response: { 201: TaskSchema },
        },
        handler: async ({ body, reply }) => {
          const task = await createTask(body, deps)
          reply.code(201)
          return task
        },
      }),
    )

    await app.register(
      defineAction<unknown, GetTaskParams>({
        method: 'GET',
        url: '/tasks/:id',
        schema: {
          params: GetTaskParamsSchema,
          response: { 200: TaskSchema },
        },
        handler: async ({ params, reply }) => {
          const task = await getTask(params.id, deps)
          if (!task) {
            throw reply.server.httpErrors.notFound(`task ${params.id} not found`)
          }
          return task
        },
      }),
    )
  }
}
