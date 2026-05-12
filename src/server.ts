import { createApp } from './app.ts'

const port = Number(process.env['PORT'] ?? 3003)
const host = process.env['HOST'] ?? '127.0.0.1'

const server = createApp()

server.listen(port, host, () => {
  console.log(`server listening at http://${host}:${port}/`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
