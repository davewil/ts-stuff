export type Task = {
  readonly id: string
  readonly title: string
  readonly createdAt: string
}

export type CreateTaskInput = {
  readonly title: string
}

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
  const trimmed = input.title.trim()
  if (trimmed.length === 0) {
    throw new TaskValidationError('title must not be empty')
  }
  if (trimmed.length > 200) {
    throw new TaskValidationError('title must be 200 characters or fewer')
  }
  const task: Task = {
    id: deps.id(),
    title: trimmed,
    createdAt: deps.clock().toISOString(),
  }
  deps.repo.insert(task)
  return task
}

export function getTask(id: string, deps: Pick<TaskDeps, 'repo'>): Task | undefined {
  return deps.repo.findById(id)
}
