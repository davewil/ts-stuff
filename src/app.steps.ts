import { expect } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.ts'
import { createInMemoryTaskRepo } from './domain/tasks.ts'

let app: FastifyInstance | undefined
let baseUrl = ''

export async function start_app_server(): Promise<void> {
  let counter = 0
  const a = await buildApp({
    taskDeps: {
      repo: createInMemoryTaskRepo(),
      clock: () => new Date('2026-05-12T00:00:00.000Z'),
      id: () => `task_${++counter}`,
    },
  })
  app = a
  baseUrl = await a.listen({ host: '127.0.0.1', port: 0 })
}

export async function stop_app_server(): Promise<void> {
  await app?.close()
  app = undefined
  baseUrl = ''
}

export async function health_returns_ok(): Promise<void> {
  const res = await fetch(`${baseUrl}/health`)
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toContain('application/json')
  expect(await res.json()).toEqual({ status: 'ok' })
}

export async function post_then_get_task_round_trip(): Promise<void> {
  const create = await fetch(`${baseUrl}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'practice fastify' }),
  })
  expect(create.status).toBe(201)
  const task = (await create.json()) as {
    id: string
    title: string
    createdAt: string
  }
  expect(task.title).toBe('practice fastify')
  expect(task.id).toMatch(/^task_/)

  const get = await fetch(`${baseUrl}/tasks/${task.id}`)
  expect(get.status).toBe(200)
  expect(await get.json()).toEqual(task)
}

export async function missing_title_returns_400_problem_json(): Promise<void> {
  const res = await fetch(`${baseUrl}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })
  expect(res.status).toBe(400)
  expect(res.headers.get('content-type')).toContain('application/problem+json')
  const body = (await res.json()) as {
    type: string
    status: number
    detail: string
  }
  expect(body.type).toBe('invalid_body')
  expect(body.status).toBe(400)
  expect(body.detail).toMatch(/title/i)
}

export async function strict_schema_rejects_unknown_keys(): Promise<void> {
  const res = await fetch(`${baseUrl}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'fine', injected: 'value' }),
  })
  expect(res.status).toBe(400)
  const body = (await res.json()) as { type: string; detail: string }
  expect(body.type).toBe('invalid_body')
  expect(body.detail).toMatch(/injected|unrecognized|unknown/i)
}

export async function invalid_json_body_returns_400(): Promise<void> {
  const res = await fetch(`${baseUrl}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'not json',
  })
  expect(res.status).toBe(400)
  const body = (await res.json()) as { type: string }
  expect(body.type).toBe('invalid_json')
}

export async function unknown_task_id_returns_404(): Promise<void> {
  const res = await fetch(`${baseUrl}/tasks/does-not-exist`)
  expect(res.status).toBe(404)
  const body = (await res.json()) as { type: string }
  expect(body.type).toBe('not_found')
}

export async function unknown_route_returns_404_problem_json(): Promise<void> {
  const res = await fetch(`${baseUrl}/nope`)
  expect(res.status).toBe(404)
  const body = (await res.json()) as { type: string }
  expect(body.type).toBe('route_not_found')
}
