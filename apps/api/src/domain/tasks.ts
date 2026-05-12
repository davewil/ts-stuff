import {
  TaskTitleSchema,
  type CreateTaskInput,
  type Task,
} from '../contracts/index.ts'

export type { CreateTaskInput, Task } from '../contracts/index.ts'

export type TaskRepo = {
  insert: (task: Task) => Promise<void>
  findById: (id: string) => Promise<Task | undefined>
}

export type Clock = () => Date
export type IdGen = () => string

export type TaskDeps = {
  repo: TaskRepo
  clock: Clock
  id: IdGen
}

export class TaskValidationError extends Error {
  override readonly name = 'TaskValidationError'
}

export async function createTask(
  input: CreateTaskInput,
  deps: TaskDeps,
): Promise<Task> {
  const result = TaskTitleSchema.safeParse(input.title)
  if (!result.success) {
    const first = result.error.issues[0]
    throw new TaskValidationError(first?.message ?? 'invalid title')
  }
  const task: Task = {
    id: deps.id(),
    title: result.data,
    createdAt: deps.clock().toISOString(),
  }
  await deps.repo.insert(task)
  return task
}

export function getTask(
  id: string,
  deps: Pick<TaskDeps, 'repo'>,
): Promise<Task | undefined> {
  return deps.repo.findById(id)
}
