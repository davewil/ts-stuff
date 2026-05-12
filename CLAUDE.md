# node-ts-test — project conventions

Interview-prep test bed for a regulated multi-tenant Node/TS backend. See [STACK_DECISIONS.md](STACK_DECISIONS.md) and [FUTURE_WEB_API_DEEP.md](FUTURE_WEB_API_DEEP.md) for the broader stack reasoning.

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
