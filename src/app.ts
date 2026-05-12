import { createServer, type RequestListener, type Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import { createRouter } from './lib/router.ts'
import { sendProblem } from './lib/http.ts'
import { createInMemoryTaskRepo, type TaskDeps } from './domain/tasks.ts'
import { healthHandler } from './routes/health.ts'
import { getTaskHandler, postTaskHandler } from './routes/tasks.ts'

export type AppOverrides = {
  taskDeps?: TaskDeps
}

export function buildApp(overrides: AppOverrides = {}): RequestListener {
  const taskDeps: TaskDeps = overrides.taskDeps ?? {
    repo: createInMemoryTaskRepo(),
    clock: () => new Date(),
    id: () => randomUUID(),
  }

  const router = createRouter()
  router.add('GET', '/health', healthHandler)
  router.add('POST', '/tasks', postTaskHandler(taskDeps))
  router.add('GET', '/tasks/:id', getTaskHandler(taskDeps))

  return async (req, res) => {
    try {
      await router.dispatch(req, res)
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown error'
      sendProblem(res, 500, 'internal_error', detail)
    }
  }
}

export function createApp(overrides: AppOverrides = {}): Server {
  return createServer(buildApp(overrides))
}
