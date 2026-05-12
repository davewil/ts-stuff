import {
  TaskTitleSchema,
  type CreateTaskInput,
  type Task,
} from '../contracts/index.ts'

export type { CreateTaskInput, Task } from '../contracts/index.ts'

export type TaskRepo = {
  insert: (task: Task) => void
  findById: (id: string) => Task | undefined
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

export function createInMemoryTaskRepo(): TaskRepo {
  const store = new Map<string, Task>()
  return {
    insert(task) {
      store.set(task.id, task)
    },
    findById(id) {
      return store.get(id)
    },
  }
}

export function createTask(input: CreateTaskInput, deps: TaskDeps): Task {
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
  deps.repo.insert(task)
  return task
}

export function getTask(id: string, deps: Pick<TaskDeps, 'repo'>): Task | undefined {
  return deps.repo.findById(id)
}
