import { buildApp } from './app.ts'

const port = Number(process.env['PORT'] ?? 3003)
const host = process.env['HOST'] ?? '127.0.0.1'

const app = await buildApp({ loggerEnabled: true })

try {
  const address = await app.listen({ host, port })
  app.log.info({ address }, 'server listening')
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info({ signal }, 'shutting down')
    await app.close()
    process.exit(0)
  })
}
