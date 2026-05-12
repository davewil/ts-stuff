import { expect } from 'vitest'
import {
  TaskValidationError,
  createInMemoryTaskRepo,
  createTask,
  getTask,
  type Clock,
  type IdGen,
  type TaskDeps,
} from './tasks.ts'

const fixedClock: Clock = () => new Date('2026-05-12T00:00:00.000Z')

function sequentialIds(): IdGen {
  let n = 0
  return () => `task_${++n}`
}

function freshDeps(): TaskDeps {
  return {
    repo: createInMemoryTaskRepo(),
    clock: fixedClock,
    id: sequentialIds(),
  }
}

export function persists_task_with_trimmed_title(): void {
  const deps = freshDeps()
  const task = createTask({ title: '  write tests  ' }, deps)
  expect(task).toEqual({
    id: 'task_1',
    title: 'write tests',
    createdAt: '2026-05-12T00:00:00.000Z',
  })
  expect(getTask('task_1', { repo: deps.repo })).toEqual(task)
}

export function assigns_sequential_ids_across_creates(): void {
  const deps = freshDeps()
  const first = createTask({ title: 'a' }, deps)
  const second = createTask({ title: 'b' }, deps)
  expect(first.id).toBe('task_1')
  expect(second.id).toBe('task_2')
}

export function rejects_empty_title(): void {
  const deps = freshDeps()
  expect(() => createTask({ title: '   ' }, deps)).toThrow(TaskValidationError)
}

export function rejects_title_over_200_chars(): void {
  const deps = freshDeps()
  expect(() => createTask({ title: 'x'.repeat(201) }, deps)).toThrow(TaskValidationError)
}

export function returns_undefined_for_unknown_id(): void {
  const deps = freshDeps()
  expect(getTask('missing-id', { repo: deps.repo })).toBeUndefined()
}
