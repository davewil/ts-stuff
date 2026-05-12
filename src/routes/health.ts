import type { Handler } from '../lib/router.ts'
import { sendJson } from '../lib/http.ts'

export const healthHandler: Handler = ({ res }) => {
  sendJson(res, 200, { status: 'ok' })
}
