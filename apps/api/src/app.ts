import { buildApp, type BuildAppOptions } from '@app/server'
import type { FastifyInstance } from 'fastify'
import { makeTaskRoutes } from './routes/tasks.ts'
import type { TaskDeps } from './domain/tasks.ts'

export type ApiAppOptions = {
  taskDeps: TaskDeps
  logger?: BuildAppOptions['logger']
}

export async function buildApiApp(
  opts: ApiAppOptions,
): Promise<FastifyInstance> {
  const serverOpts: BuildAppOptions = {
    routes: [makeTaskRoutes(opts.taskDeps)],
    ...(opts.logger !== undefined ? { logger: opts.logger } : {}),
  }
  return buildApp(serverOpts)
}
