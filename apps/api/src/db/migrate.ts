import { migrate as migratePostgresJs } from 'drizzle-orm/postgres-js/migrator'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { PgliteDatabase } from 'drizzle-orm/pglite'

export const MIGRATIONS_FOLDER = './src/db/migrations'

export function migratePg<S extends Record<string, unknown>>(
  db: PostgresJsDatabase<S>,
): Promise<void> {
  return migratePostgresJs(db, { migrationsFolder: MIGRATIONS_FOLDER })
}

export function migratePgliteDb<S extends Record<string, unknown>>(
  db: PgliteDatabase<S>,
): Promise<void> {
  return migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER })
}
