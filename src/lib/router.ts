import type { IncomingMessage, ServerResponse } from 'node:http'
import { sendProblem } from './http.ts'

export type RouteContext = {
  req: IncomingMessage
  res: ServerResponse
  url: URL
  params: Readonly<Record<string, string>>
}

export type Handler = (ctx: RouteContext) => Promise<void> | void

type CompiledRoute = {
  method: string
  pattern: RegExp
  keys: readonly string[]
  handler: Handler
}

function compile(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = []
  const source = path.replace(/:([^/]+)/g, (_match, key: string) => {
    keys.push(key)
    return '([^/]+)'
  })
  return { pattern: new RegExp(`^${source}$`), keys }
}

export type Router = {
  add: (method: string, path: string, handler: Handler) => void
  dispatch: (req: IncomingMessage, res: ServerResponse) => Promise<void>
}

export function createRouter(): Router {
  const routes: CompiledRoute[] = []

  return {
    add(method, path, handler) {
      const { pattern, keys } = compile(path)
      routes.push({ method, pattern, keys, handler })
    },

    async dispatch(req, res) {
      const host = req.headers.host ?? 'localhost'
      const url = new URL(req.url ?? '/', `http://${host}`)
      const method = req.method ?? 'GET'

      for (const route of routes) {
        if (route.method !== method) continue
        const match = url.pathname.match(route.pattern)
        if (!match) continue

        const params: Record<string, string> = {}
        route.keys.forEach((key, index) => {
          const value = match[index + 1]
          if (value !== undefined) params[key] = value
        })

        await route.handler({ req, res, url, params })
        return
      }

      sendProblem(res, 404, 'route_not_found', `no route for ${method} ${url.pathname}`)
    },
  }
}
