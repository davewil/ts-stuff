import { expect } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { buildApp, defineAction, getRequestId } from './index.ts'

let app: FastifyInstance | undefined
let baseUrl = ''

async function startWithEchoIdRoute(): Promise<void> {
  const echoId = defineAction({
    method: 'GET',
    url: '/echo-id',
    schema: {
      response: { 200: z.object({ id: z.string().nullable() }) },
    },
    handler: () => ({ id: getRequestId() ?? null }),
  })
  app = await buildApp({ routes: [echoId] })
  baseUrl = await app.listen({ host: '127.0.0.1', port: 0 })
}

export async function stop_request_context_harness(): Promise<void> {
  await app?.close()
  app = undefined
  baseUrl = ''
}

export async function get_request_id_returns_bound_value_inside_handler(): Promise<void> {
  await startWithEchoIdRoute()
  const res = await fetch(`${baseUrl}/echo-id`)
  expect(res.status).toBe(200)
  const body = (await res.json()) as { id: string | null }
  expect(body.id).not.toBeNull()
  expect(body.id).toMatch(/^req-/)
}

export async function get_request_id_isolates_per_request(): Promise<void> {
  await startWithEchoIdRoute()
  const [a, b] = await Promise.all([
    fetch(`${baseUrl}/echo-id`).then((r) => r.json()),
    fetch(`${baseUrl}/echo-id`).then((r) => r.json()),
  ])
  const idA = (a as { id: string }).id
  const idB = (b as { id: string }).id
  expect(idA).toMatch(/^req-/)
  expect(idB).toMatch(/^req-/)
  expect(idA).not.toBe(idB)
}

export function get_request_id_returns_undefined_outside_request(): void {
  expect(getRequestId()).toBeUndefined()
}
