import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { PgliteDatabase } from 'drizzle-orm/pglite'
import { tasks } from './schema.ts'
import type { Task } from '../contracts/index.ts'
import type { TaskRepo } from '../domain/tasks.ts'

type AnyDrizzleDb =
  | PostgresJsDatabase<Record<string, unknown>>
  | PgliteDatabase<Record<string, unknown>>

export function createDrizzleTaskRepo(db: AnyDrizzleDb): TaskRepo {
  return {
    async insert(task: Task): Promise<void> {
      await db.insert(tasks).values({
        id: task.id,
        title: task.title,
        createdAt: new Date(task.createdAt),
      })
    },

    async findById(id: string): Promise<Task | undefined> {
      const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1)
      const row = rows[0]
      if (!row) return undefined
      return {
        id: row.id,
        title: row.title,
        createdAt: row.createdAt.toISOString(),
      }
    },
  }
}
