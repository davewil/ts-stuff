import postgres from 'postgres'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from './schema.ts'

export type Schema = typeof schema
export type AppPostgresDb = PostgresJsDatabase<Schema>

export type DbClient = {
  db: AppPostgresDb
  close: () => Promise<void>
}

export function createPgClient(connectionString: string): DbClient {
  const sql = postgres(connectionString, {
    max: 10,
    onnotice: () => {},
  })
  const db = drizzle(sql, { schema })
  return {
    db,
    close: () => sql.end(),
  }
}
