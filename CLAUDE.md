# node-ts-test — project conventions

Interview-prep test bed for a regulated multi-tenant Node/TS backend. See [STACK_DECISIONS.md](STACK_DECISIONS.md) and [FUTURE_WEB_API_DEEP.md](FUTURE_WEB_API_DEEP.md) for the broader stack reasoning.

## Monorepo layout (pnpm workspaces)

```
packages/server/   -- @app/server: reusable buildApp, defineAction, problem+json
apps/api/          -- the tasks demo app (HTTP + domain + Postgres)
```

- `@app/server` is the platform library. Future services depending on it import via `workspace:*`; the package exports `.ts` directly so there's no build step (Node 24 strips types, vitest transforms in dev).
- `apps/api` is the only consumer today. Adding a second consumer means another folder under `apps/` and another `workspace:*` dependency.
- Run things from the root: `pnpm test`, `pnpm typecheck`, `pnpm dev`, `pnpm start`, `pnpm db:generate`. Most root scripts just fan out via `pnpm -r` or `pnpm -F api`.
- Tests live next to the code that owns them. `packages/server` owns the library contract tests (buildApp, problem+json mapper). `apps/api` owns the consumer behaviour tests (real HTTP, real Postgres).

## Test organisation: scenario catalogue + steps file

Every test file is split in two:

| File | Role | Shape |
|---|---|---|
| `<thing>.test.ts` | Scenario catalogue | `describe`/`it` calls only — no inline logic, no closures, no `expect` calls |
| `<thing>.steps.ts` | Step bodies + preconditions | Exported zero-arg `() => void \| Promise<void>` functions, one per scenario |

### Rules

1. **The test file imports named step functions and binds them to `it`**:

   ```ts
   import { persists_task_with_trimmed_title, rejects_empty_title } from './tasks.steps.ts'

   describe('createTask', () => {
     it('persists a task with id, trimmed title, and ISO createdAt', persists_task_with_trimmed_title)
     it('rejects whitespace-only titles', rejects_empty_title)
   })
   ```

2. **Step functions are self-contained.** Each builds its own dependencies, performs the action, and asserts. No shared mutable "world" between tests — tests must remain independent and re-orderable.

3. **Lifecycle hooks (`beforeAll`, `beforeEach`, `afterAll`) are also exported zero-arg functions** from the steps file. The test file passes them by reference:

   ```ts
   beforeAll(start_app_server)
   afterAll(stop_app_server)
   ```

   This is how shared HTTP harness state (server, baseUrl) is initialised — see [src/app.steps.ts](src/app.steps.ts).

4. **Step function names use `snake_case`** and read as sentence fragments. The test file's `it` description documents *intent*; the step name documents the *mechanism*. They don't have to match word-for-word.

5. **Module-scoped state in `*.steps.ts` is permitted only for harness lifecycle** (e.g. the running server) — never to pass values between tests. If two tests need related setup, each builds it independently in its own step.

6. **No `describe.skip`/`it.skip` in committed code.** Either delete the scenario or implement it.

### Why this shape

- The `.test.ts` file reads as a behaviour spec — scannable by a reviewer who only wants to know *what is covered*.
- Steps are reusable: a precondition like `with_clock_at(iso)` can serve multiple test files.
- Refactors that change the *mechanism* (Fastify swap, new validation lib) touch only `*.steps.ts`; the catalogue stays stable.
- Clicking a step name in the IDE jumps straight to the implementation — no nested-closure navigation.

### Anti-patterns to avoid

- Putting `expect` calls or fetch/IO inside the `*.test.ts` file.
- Sharing a `let world` between tests at module scope to chain state across `it` blocks.
- Using `describe` callback bodies for real work (DB queries, fetches) — those run at *collection time*, before any `beforeEach`. Put async setup in `beforeAll`/`beforeEach` only.
- Mixing the GWT-alias style (`Given = describe; When = describe; Then = it`) with the catalogue style in the same file. Pick one per file; the catalogue style is the default here.

### Examples in this repo

- [src/domain/tasks.test.ts](src/domain/tasks.test.ts) + [src/domain/tasks.steps.ts](src/domain/tasks.steps.ts) — pure unit-test shape with `freshDeps()` helper per step.
- [src/app.test.ts](src/app.test.ts) + [src/app.steps.ts](src/app.steps.ts) — HTTP integration shape with `start_app_server` / `stop_app_server` lifecycle steps.

## Data layer: Drizzle on Postgres (`src/db/`)

Per [STACK_DECISIONS.md](STACK_DECISIONS.md), the runtime database is Postgres accessed via Drizzle on top of the `postgres` (porsager) driver. The in-memory repo has been retired — every test now exercises real SQL.

- [src/db/schema.ts](src/db/schema.ts) is the Drizzle source of truth. Migrations are generated with `pnpm db:generate` (writes SQL files to `src/db/migrations/`).
- [src/db/client.ts](src/db/client.ts) exports `createPgClient(url)` for production (postgres-js + Drizzle). `src/db/migrate.ts` exposes `migratePg` (postgres-js) and `migratePgliteDb` (in-process PGlite) for the two test paths.
- [src/db/task-repo.ts](src/db/task-repo.ts) is driver-agnostic: `createDrizzleTaskRepo(db)` accepts either a `PostgresJsDatabase` or a `PgliteDatabase`. Both share the same query code so the production codepath is exercised by every domain test.
- `DATABASE_URL` is required at boot in production; the server runs pending migrations before opening the listener.

### Dual test strategy

- **Domain tests** (`src/domain/*.test.ts`) use **PGlite** — in-process WASM Postgres — for sub-second feedback. Each `freshDeps()` builds a new PGlite instance and applies migrations.
- **HTTP integration tests** (`src/app.test.ts`) use **`@testcontainers/postgresql`** — spawns a real `postgres:16-alpine` container shared across the suite via `beforeAll(start_app_server)` / `afterAll(stop_app_server)`. Maximum fidelity to prod.
- Running tests inside the Docker image (`docker compose run --rm test`) works because the test service mounts `/var/run/docker.sock`; Testcontainers spawns sibling Postgres containers on the host daemon.

## Request context (AsyncLocalStorage)

Every Fastify request is bound to an ALS scope via `@fastify/request-context`, seeded with Fastify's own `req.id`. Domain code or other downstream-from-request functions can read it without parameter threading.

- [packages/server/src/request-context.ts](packages/server/src/request-context.ts) exposes `getRequestId()` and `getRequestContext()` — both return `undefined` when called outside a request scope, which is the right semantics for unit tests and bootstrap code.
- `buildApp` registers the plugin and an `onRequest` hook that calls `req.requestContext.set('requestId', req.id)`. Adding more context fields (tenantId, userId) later means augmenting the `RequestContextData` interface and setting them in a subsequent hook.
- Concurrent requests are isolated by ALS — this is verified by `packages/server/src/request-context.test.ts` which fires two requests in parallel and asserts the bound id differs.

## Structured logging: Pino via Fastify

Logging is configured at the `@app/server` layer; consumers pass a `logger` option to `buildApp`. Pino is provided transitively by Fastify — we don't import it directly.

- [packages/server/src/logger.ts](packages/server/src/logger.ts) exports `defaultLoggerOptions(env)` and `detectLoggerEnv()`. Production emits structured JSON at `info`; development pretty-prints at `debug` via `pino-pretty`; test returns `false` (no logger noise).
- `LOG_LEVEL` env var overrides the per-env default — useful for production debug spelunking without redeploying.
- Sensitive headers and common field names are redacted at the logger boundary: `req.headers.authorization`, `req.headers.cookie`, `*.password`, `*.token`, `*.apiKey`. Adding more redactions is the safest place to do it (vs. per-handler).
- `pino-pretty` is an `apps/api` devDependency; the production Docker image runs with `NODE_ENV=production` so the pretty transport is never loaded and the dep isn't required.

### Logging conventions (per [STACK_DECISIONS.md](STACK_DECISIONS.md))

- **Never `console.log` in app code.** Use `req.log` (request-scoped, includes `req.id`) or `app.log` (instance-scoped).
- **Pass structured objects, not interpolated strings.** `req.log.info({ taskId }, 'task created')` — never `` req.log.info(`task ${id} created`) ``.
- **Never log full request bodies.** If correlation is needed, hash the body or log a stable identifier (request id, idempotency key) instead.

## Web framework: Fastify with Zod type provider

The HTTP layer is Fastify 5 wired to the existing `src/contracts/` schemas via `@fastify/type-provider-zod`. The framework choice and plugin list track [STACK_DECISIONS.md](STACK_DECISIONS.md).

- Routes are exported as `FastifyPluginAsyncZod` plugins from `src/routes/*.ts`; each declares its schema via `body` / `params` / `response`. Handlers receive typed `req.body` / `req.params` inferred from those Zod schemas — no manual `z.infer` annotations needed at the handler boundary.
- `buildApp()` in [src/app.ts](src/app.ts) is async (plugin registration is async), composes plugins (`@fastify/sensible` + `@fastify/helmet`), wires routes, and centralises problem+json mapping in `setErrorHandler` / `setNotFoundHandler`.
- Domain-level 404s throw `app.httpErrors.notFound(...)` from `@fastify/sensible`; the error handler maps `statusCode` to a `type` discriminator (`not_found` vs `route_not_found` vs `bad_request` vs `internal_error`).
- Tests in [src/app.steps.ts](src/app.steps.ts) drive the server via real `fetch` against a `host: '127.0.0.1', port: 0` listener — implementation-agnostic, survived the Fastify swap without changes.

## Contracts (`src/contracts/`)

All API resource schemas, request/response shapes, and message envelopes live in `src/contracts/` as Zod schemas with inferred TS types. This is the single source of truth for data crossing the HTTP boundary; everything downstream (routes, domain, future event payloads) imports from here.

- Schemas are exported alongside their inferred types (`TaskSchema` + `type Task = z.infer<...>`).
- Inferred types are wrapped in `Readonly<>` where they represent values passed across boundaries.
- Inputs use `.strict()` to reject unknown keys at the HTTP boundary (defence in depth — clients catch typos early).
- Error messages use Zod 4's `{ error: "..." }` option form, not the deprecated `{ message: "..." }`.
- ISO datetimes use the top-level `z.iso.datetime()` form (Zod 4), not the deprecated `z.string().datetime()`.
- The domain re-exports its public types from contracts so consumers depend on contracts directly when possible, but can still import `Task` / `CreateTaskInput` via the domain module.

The folder is expected to be extracted into its own package (`@org/contracts` per the ledger) when Step 4 lands `buildApp` as a reusable library. Until then, keeping it as a folder avoids monorepo plumbing.

## TypeScript

- `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` are non-negotiable. Matches the ledger's "TS config convention" row.
- `.ts` extension on every import (`allowImportingTsExtensions: true`, `verbatimModuleSyntax: true`) — Node 24 strips types natively; no bundler in the loop.
- Use `import type` for type-only imports.

## Commands

- `pnpm dev` — `node --watch src/server.ts`
- `pnpm start` — `node src/server.ts`
- `pnpm test` — `vitest run`
- `pnpm test:watch` — `vitest`
- `pnpm typecheck` — `tsc --noEmit`

## Stack ledger reference

When adding dependencies or making architectural decisions, consult [STACK_DECISIONS.md](STACK_DECISIONS.md) first — it lists current picks, anti-picks, and reasons. New deviations need an ADR in `docs/adr/` (if/when that directory is created).
