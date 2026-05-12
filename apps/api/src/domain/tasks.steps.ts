import { expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import {
  TaskValidationError,
  createTask,
  getTask,
  type Clock,
  type IdGen,
  type TaskDeps,
} from './tasks.ts'
import { migratePgliteDb } from '../db/migrate.ts'
import { createDrizzleTaskRepo } from '../db/task-repo.ts'

const fixedClock: Clock = () => new Date('2026-05-12T00:00:00.000Z')

function sequentialIds(): IdGen {
  let n = 0
  return () => `task_${++n}`
}

async function freshDeps(): Promise<TaskDeps> {
  const pglite = new PGlite()
  const db = drizzle(pglite)
  await migratePgliteDb(db)
  return {
    repo: createDrizzleTaskRepo(db),
    clock: fixedClock,
    id: sequentialIds(),
  }
}

export async function persists_task_with_trimmed_title(): Promise<void> {
  const deps = await freshDeps()
  const task = await createTask({ title: '  write tests  ' }, deps)
  expect(task).toEqual({
    id: 'task_1',
    title: 'write tests',
    createdAt: '2026-05-12T00:00:00.000Z',
  })
  expect(await getTask('task_1', { repo: deps.repo })).toEqual(task)
}

export async function assigns_sequential_ids_across_creates(): Promise<void> {
  const deps = await freshDeps()
  const first = await createTask({ title: 'a' }, deps)
  const second = await createTask({ title: 'b' }, deps)
  expect(first.id).toBe('task_1')
  expect(second.id).toBe('task_2')
}

export async function rejects_empty_title(): Promise<void> {
  const deps = await freshDeps()
  await expect(createTask({ title: '   ' }, deps)).rejects.toThrow(
    TaskValidationError,
  )
}

export async function rejects_title_over_200_chars(): Promise<void> {
  const deps = await freshDeps()
  await expect(createTask({ title: 'x'.repeat(201) }, deps)).rejects.toThrow(
    TaskValidationError,
  )
}

export async function returns_undefined_for_unknown_id(): Promise<void> {
  const deps = await freshDeps()
  expect(await getTask('missing-id', { repo: deps.repo })).toBeUndefined()
}
