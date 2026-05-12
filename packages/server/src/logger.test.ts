import { afterEach, beforeEach, describe, it } from 'vitest'
import {
  detect_logger_env_maps_node_env,
  development_uses_debug_level_and_pino_pretty,
  log_level_env_overrides_default,
  production_defaults_to_info_level_with_redactions,
  redactions_cover_known_secret_paths,
  restore_env,
  snapshot_env,
  test_returns_false_in_test_env,
} from './logger.steps.ts'

describe('defaultLoggerOptions', () => {
  beforeEach(snapshot_env)
  afterEach(restore_env)

  it('returns false in test env (no logger noise)', test_returns_false_in_test_env)
  it('production defaults to info level with redactions', production_defaults_to_info_level_with_redactions)
  it('development uses debug level and pino-pretty transport', development_uses_debug_level_and_pino_pretty)
  it('LOG_LEVEL env var overrides the default level', log_level_env_overrides_default)
  it('redacts known secret-bearing paths', redactions_cover_known_secret_paths)
})

describe('detectLoggerEnv', () => {
  beforeEach(snapshot_env)
  afterEach(restore_env)

  it('maps NODE_ENV to LoggerEnv (defaults to development)', detect_logger_env_maps_node_env)
})
