import { z } from 'zod'
import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod'
import {
  CreateTaskInputSchema,
  TaskIdSchema,
  TaskSchema,
} from '../contracts/index.ts'
import { createTask, getTask, type TaskDeps } from '../domain/tasks.ts'

const GetTaskParamsSchema = z.object({
  id: TaskIdSchema,
})

export type TaskRoutesOptions = {
  deps: TaskDeps
}

export const taskRoutes: FastifyPluginAsyncZod<TaskRoutesOptions> = async (
  app,
  opts,
) => {
  const { deps } = opts

  app.post(
    '/tasks',
    {
      schema: {
        body: CreateTaskInputSchema,
        response: { 201: TaskSchema },
      },
    },
    async (req, reply) => {
      const task = await createTask(req.body, deps)
      reply.code(201)
      return task
    },
  )

  app.get(
    '/tasks/:id',
    {
      schema: {
        params: GetTaskParamsSchema,
        response: { 200: TaskSchema },
      },
    },
    async (req) => {
      const task = await getTask(req.params.id, deps)
      if (!task) {
        throw app.httpErrors.notFound(`task ${req.params.id} not found`)
      }
      return task
    },
  )
}
