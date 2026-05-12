import { afterEach, describe, it } from 'vitest'
import {
  build_app_can_disable_default_health_route,
  build_app_emits_route_not_found_problem_json,
  build_app_maps_malformed_json_to_invalid_json,
  build_app_maps_zod_validation_to_invalid_body,
  build_app_mounts_default_health_route,
  stop_build_app_harness,
} from './build-app.steps.ts'

describe('buildApp', () => {
  afterEach(stop_build_app_harness)

  it('mounts a default /health route', build_app_mounts_default_health_route)
  it('emits problem+json route_not_found for unknown URLs', build_app_emits_route_not_found_problem_json)
  it('maps Zod validation errors to invalid_body problem+json', build_app_maps_zod_validation_to_invalid_body)
  it('maps malformed JSON bodies to invalid_json problem+json', build_app_maps_malformed_json_to_invalid_json)
  it('can disable the default /health route', build_app_can_disable_default_health_route)
})
