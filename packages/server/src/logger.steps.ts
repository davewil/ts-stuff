import { afterEach, beforeEach, expect } from 'vitest'
import { defaultLoggerOptions, detectLoggerEnv } from './logger.ts'

let originalEnv: { NODE_ENV: string | undefined; LOG_LEVEL: string | undefined }

export function snapshot_env(): void {
  originalEnv = {
    NODE_ENV: process.env['NODE_ENV'],
    LOG_LEVEL: process.env['LOG_LEVEL'],
  }
}

export function restore_env(): void {
  if (originalEnv.NODE_ENV !== undefined) {
    process.env['NODE_ENV'] = originalEnv.NODE_ENV
  } else {
    delete process.env['NODE_ENV']
  }
  if (originalEnv.LOG_LEVEL !== undefined) {
    process.env['LOG_LEVEL'] = originalEnv.LOG_LEVEL
  } else {
    delete process.env['LOG_LEVEL']
  }
}

export { beforeEach, afterEach }

export function test_returns_false_in_test_env(): void {
  expect(defaultLoggerOptions('test')).toBe(false)
}

export function production_defaults_to_info_level_with_redactions(): void {
  delete process.env['LOG_LEVEL']
  const opts = defaultLoggerOptions('production')
  expect(opts).toMatchObject({
    level: 'info',
    redact: expect.objectContaining({ remove: true }),
  })
  if (typeof opts === 'object' && opts && 'transport' in opts) {
    expect(opts.transport).toBeUndefined()
  }
}

export function development_uses_debug_level_and_pino_pretty(): void {
  delete process.env['LOG_LEVEL']
  const opts = defaultLoggerOptions('development')
  expect(opts).toMatchObject({
    level: 'debug',
    transport: expect.objectContaining({ target: 'pino-pretty' }),
  })
}

export function log_level_env_overrides_default(): void {
  process.env['LOG_LEVEL'] = 'warn'
  const opts = defaultLoggerOptions('production')
  expect(opts).toMatchObject({ level: 'warn' })
}

export function redactions_cover_known_secret_paths(): void {
  const opts = defaultLoggerOptions('production')
  if (typeof opts !== 'object' || !opts || !('redact' in opts) || !opts.redact) {
    throw new Error('expected redact configuration')
  }
  const redact = opts.redact as { paths: readonly string[] }
  expect(redact.paths).toEqual(
    expect.arrayContaining([
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
    ]),
  )
}

export function detect_logger_env_maps_node_env(): void {
  process.env['NODE_ENV'] = 'production'
  expect(detectLoggerEnv()).toBe('production')
  process.env['NODE_ENV'] = 'test'
  expect(detectLoggerEnv()).toBe('test')
  process.env['NODE_ENV'] = 'development'
  expect(detectLoggerEnv()).toBe('development')
  delete process.env['NODE_ENV']
  expect(detectLoggerEnv()).toBe('development')
}
