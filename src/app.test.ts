import { afterAll, beforeAll, describe, it } from 'vitest'
import {
  health_returns_ok,
  invalid_json_body_returns_400,
  missing_title_returns_400_problem_json,
  post_then_get_task_round_trip,
  start_app_server,
  stop_app_server,
  unknown_route_returns_404_problem_json,
  unknown_task_id_returns_404,
} from './app.steps.ts'

describe('HTTP API', () => {
  beforeAll(start_app_server)
  afterAll(stop_app_server)

  describe('GET /health', () => {
    it('returns ok', health_returns_ok)
  })

  describe('POST /tasks then GET /tasks/:id', () => {
    it('creates a task and retrieves it', post_then_get_task_round_trip)
    it('returns problem+json 400 when title is missing', missing_title_returns_400_problem_json)
    it('returns 400 for non-JSON bodies', invalid_json_body_returns_400)
    it('returns 404 for unknown task id', unknown_task_id_returns_404)
  })

  describe('unknown route', () => {
    it('returns 404 problem+json', unknown_route_returns_404_problem_json)
  })
})
