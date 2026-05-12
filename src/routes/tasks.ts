import type { Handler } from '../lib/router.ts'
import { InvalidJsonError, readJson, sendJson, sendProblem } from '../lib/http.ts'
import {
  createTask,
  getTask,
  TaskValidationError,
  type TaskDeps,
} from '../domain/tasks.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function postTaskHandler(deps: TaskDeps): Handler {
  return async ({ req, res }) => {
    let body: unknown
    try {
      body = await readJson(req)
    } catch (err) {
      if (err instanceof InvalidJsonError) {
        return sendProblem(res, 400, 'invalid_json', err.message)
      }
      throw err
    }

    if (!isRecord(body) || typeof body['title'] !== 'string') {
      return sendProblem(res, 400, 'invalid_body', 'title (string) is required')
    }

    try {
      const task = createTask({ title: body['title'] }, deps)
      sendJson(res, 201, task)
    } catch (err) {
      if (err instanceof TaskValidationError) {
        return sendProblem(res, 400, 'invalid_body', err.message)
      }
      throw err
    }
  }
}

export function getTaskHandler(deps: Pick<TaskDeps, 'repo'>): Handler {
  return ({ res, params }) => {
    const id = params['id']
    if (id === undefined) {
      return sendProblem(res, 400, 'invalid_path', 'id is required')
    }
    const task = getTask(id, deps)
    if (!task) {
      return sendProblem(res, 404, 'not_found', `task ${id} not found`)
    }
    sendJson(res, 200, task)
  }
}
