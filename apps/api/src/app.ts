import { buildApp, type BuildAppOptions } from '@app/server'
import type { FastifyInstance } from 'fastify'
import { makeTaskRoutes } from './routes/tasks.ts'
import type { TaskDeps } from './domain/tasks.ts'

export type ApiAppOptions = {
  taskDeps: TaskDeps
  loggerEnabled?: boolean
}

export async function buildApiApp(
  opts: ApiAppOptions,
): Promise<FastifyInstance> {
  const serverOpts: BuildAppOptions = {
    routes: [makeTaskRoutes(opts.taskDeps)],
    ...(opts.loggerEnabled !== undefined
      ? { loggerEnabled: opts.loggerEnabled }
      : {}),
  }
  return buildApp(serverOpts)
}
