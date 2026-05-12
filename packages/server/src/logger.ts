import type { FastifyServerOptions } from 'fastify'
import { traceMixin } from './telemetry-mixin.ts'

export type LoggerEnv = 'development' | 'production' | 'test'

export type LoggerOption = FastifyServerOptions['logger']

const DEFAULT_REDACT_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.token',
  '*.apiKey',
  '*.api_key',
]

export function detectLoggerEnv(): LoggerEnv {
  const env = process.env['NODE_ENV']
  if (env === 'production') return 'production'
  if (env === 'test') return 'test'
  return 'development'
}

export function defaultLoggerOptions(env: LoggerEnv = 'production'): LoggerOption {
  if (env === 'test') return false

  const level =
    process.env['LOG_LEVEL'] ?? (env === 'production' ? 'info' : 'debug')

  const redact = {
    paths: [...DEFAULT_REDACT_PATHS],
    remove: true,
  }

  if (env === 'development') {
    return {
      level,
      redact,
      mixin: traceMixin,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      },
    }
  }

  return { level, redact, mixin: traceMixin }
}
