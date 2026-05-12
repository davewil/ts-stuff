import { randomUUID } from 'node:crypto'
import { buildApiApp } from './app.ts'
import { createPgClient } from './db/client.ts'
import { migratePg } from './db/migrate.ts'
import { createDrizzleTaskRepo } from './db/task-repo.ts'

const port = Number(process.env['PORT'] ?? 3003)
const host = process.env['HOST'] ?? '127.0.0.1'
const databaseUrl = process.env['DATABASE_URL']
if (!databaseUrl) {
  console.error('DATABASE_URL env var is required')
  process.exit(1)
}

const dbClient = createPgClient(databaseUrl)
await migratePg(dbClient.db)

const app = await buildApiApp({
  taskDeps: {
    repo: createDrizzleTaskRepo(dbClient.db),
    clock: () => new Date(),
    id: () => randomUUID(),
  },
  loggerEnabled: true,
})

try {
  const address = await app.listen({ host, port })
  app.log.info({ address }, 'server listening')
} catch (err) {
  app.log.error(err)
  await dbClient.close()
  process.exit(1)
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info({ signal }, 'shutting down')
    await app.close()
    await dbClient.close()
    process.exit(0)
  })
}
