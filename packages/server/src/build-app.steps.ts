import { expect } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { buildApp, defineAction } from './index.ts'

let app: FastifyInstance | undefined
let baseUrl = ''

async function startBuildAppHarness(
  routes: Parameters<typeof buildApp>[0] extends infer T
    ? T extends { routes?: infer R }
      ? R
      : never
    : never,
): Promise<void> {
  app = await buildApp({ routes })
  baseUrl = await app.listen({ host: '127.0.0.1', port: 0 })
}

export async function stop_build_app_harness(): Promise<void> {
  await app?.close()
  app = undefined
  baseUrl = ''
}

export async function build_app_mounts_default_health_route(): Promise<void> {
  await startBuildAppHarness([])
  const res = await fetch(`${baseUrl}/health`)
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ status: 'ok' })
}

export async function build_app_emits_route_not_found_problem_json(): Promise<void> {
  await startBuildAppHarness([])
  const res = await fetch(`${baseUrl}/no-such-route`)
  expect(res.status).toBe(404)
  expect(res.headers.get('content-type')).toContain('application/problem+json')
  const body = (await res.json()) as { type: string; status: number }
  expect(body.type).toBe('route_not_found')
  expect(body.status).toBe(404)
}

export async function build_app_maps_zod_validation_to_invalid_body(): Promise<void> {
  const echoBody = defineAction({
    method: 'POST',
    url: '/echo',
    schema: {
      body: z.object({ name: z.string().min(1) }).strict(),
      response: { 200: z.object({ ok: z.literal(true) }) },
    },
    handler: () => ({ ok: true as const }),
  })
  await startBuildAppHarness([echoBody])

  const res = await fetch(`${baseUrl}/echo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })
  expect(res.status).toBe(400)
  const body = (await res.json()) as { type: string; detail: string }
  expect(body.type).toBe('invalid_body')
  expect(body.detail.toLowerCase()).toContain('name')
}

export async function build_app_maps_malformed_json_to_invalid_json(): Promise<void> {
  const echoBody = defineAction({
    method: 'POST',
    url: '/echo',
    schema: {
      body: z.object({ name: z.string() }),
      response: { 200: z.object({ ok: z.literal(true) }) },
    },
    handler: () => ({ ok: true as const }),
  })
  await startBuildAppHarness([echoBody])

  const res = await fetch(`${baseUrl}/echo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'not json',
  })
  expect(res.status).toBe(400)
  const body = (await res.json()) as { type: string }
  expect(body.type).toBe('invalid_json')
}

export async function build_app_can_disable_default_health_route(): Promise<void> {
  app = await buildApp({ mountHealth: false })
  baseUrl = await app.listen({ host: '127.0.0.1', port: 0 })
  const res = await fetch(`${baseUrl}/health`)
  expect(res.status).toBe(404)
  const body = (await res.json()) as { type: string }
  expect(body.type).toBe('route_not_found')
}
