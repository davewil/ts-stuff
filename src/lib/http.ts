import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Problem } from '../contracts/index.ts'

export type { Problem } from '../contracts/index.ts'

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export function sendProblem(
  res: ServerResponse,
  status: number,
  type: string,
  detail: string,
): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/problem+json; charset=utf-8')
  const body: Problem = {
    type,
    title: type.replace(/_/g, ' '),
    status,
    detail,
  }
  res.end(JSON.stringify(body))
}

export class InvalidJsonError extends Error {
  override readonly name = 'InvalidJsonError'
}

export async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  if (chunks.length === 0) return undefined
  const raw = Buffer.concat(chunks).toString('utf8')
  try {
    return JSON.parse(raw)
  } catch {
    throw new InvalidJsonError('body is not valid JSON')
  }
}
