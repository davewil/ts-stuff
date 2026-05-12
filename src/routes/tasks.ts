import type { IncomingMessage } from 'node:http'
import { match } from 'ts-pattern'
import type { Handler } from '../lib/router.ts'
import { InvalidJsonError, readJson, sendJson, sendProblem } from '../lib/http.ts'
import {
  createTask,
  getTask,
  TaskValidationError,
  type TaskDeps,
} from '../domain/tasks.ts'
import { CreateTaskInputSchema, type Task } from '../contracts/index.ts'

type PostOutcome =
  | { kind: 'created'; task: Task }
  | { kind: 'invalid_json'; detail: string }
  | { kind: 'invalid_body'; detail: string }

async function evaluatePostTask(
  req: IncomingMessage,
  deps: TaskDeps,
): Promise<PostOutcome> {
  let raw: unknown
  try {
    raw = await readJson(req)
  } catch (err) {
    if (err instanceof InvalidJsonError) {
      return { kind: 'invalid_json', detail: err.message }
    }
    throw err
  }

  const parsed = CreateTaskInputSchema.safeParse(raw)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => {
        const path = issue.path.join('.')
        return path ? `${path}: ${issue.message}` : issue.message
      })
      .join('; ')
    return { kind: 'invalid_body', detail }
  }

  try {
    const task = createTask(parsed.data, deps)
    return { kind: 'created', task }
  } catch (err) {
    if (err instanceof TaskValidationError) {
      return { kind: 'invalid_body', detail: err.message }
    }
    throw err
  }
}

export function postTaskHandler(deps: TaskDeps): Handler {
  return async ({ req, res }) => {
    const outcome = await evaluatePostTask(req, deps)
    match(outcome)
      .with({ kind: 'created' }, ({ task }) => sendJson(res, 201, task))
      .with({ kind: 'invalid_json' }, ({ detail }) =>
        sendProblem(res, 400, 'invalid_json', detail),
      )
      .with({ kind: 'invalid_body' }, ({ detail }) =>
        sendProblem(res, 400, 'invalid_body', detail),
      )
      .exhaustive()
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
