# ts-stuff — regulated Node/TS backend test bed & docs.davewil.dev

A working reference implementation of a **production-shaped, regulated multi-tenant
Node/TS backend**, built as interview-prep and as the substrate behind
**[docs.davewil.dev](https://docs.davewil.dev)**. It is not a scratch repo despite the
`node-ts-test` package name — it's a pnpm monorepo carrying a reusable server platform,
a demo service that consumes it, and a themed documentation hub.

## What's in here

```
packages/server/   @app/server — reusable platform library:
                   buildApp, problem+json mapping, structured logging,
                   OpenTelemetry tracing, AsyncLocalStorage request context
apps/api/          tasks demo service — Fastify 5 + Zod + Drizzle/Postgres,
                   the only consumer of @app/server today
apps/docs-hub/     docs.davewil.dev — data-driven docs hub (Rosé Pine, themeable)
cheatsheets/       standalone HTML reference cards served alongside the hub
docs/              deployment config (nginx, caddy labels, prod compose)
STACK_DECISIONS.md the stack ledger — current picks, anti-picks, and reasons
CLAUDE.md          working conventions (test shape, logging, citations, layout)
```

`@app/server` exports `.ts` directly — Node 24 strips types, so there's no build step.
Future services depend on it via `workspace:*`.

## Stack

| Concern | Choice |
|---|---|
| HTTP | Fastify 5 + `@fastify/type-provider-zod` |
| Contracts | Zod schemas in `src/contracts/` (single source of truth) |
| Data | Drizzle on Postgres (porsager `postgres` driver) |
| Tests | PGlite (fast domain tests) + Testcontainers (real-Postgres HTTP tests) |
| Observability | OpenTelemetry traces + Pino logs, correlated by `traceId`/`requestId` |
| Runtime | Node ≥ 24.15, pnpm 11, TypeScript `strict` + `noUncheckedIndexedAccess` |

See [STACK_DECISIONS.md](STACK_DECISIONS.md) for the reasoning behind each pick.

## Getting started

```bash
pnpm install
pnpm dev         # node --watch, the api service
pnpm test        # vitest — domain (PGlite) + HTTP (Testcontainers)
pnpm typecheck   # tsc --noEmit across the workspace
pnpm db:generate # regenerate Drizzle migrations from src/db/schema.ts
```

Root scripts fan out via `pnpm -r` / `pnpm -F api`. A running Docker daemon is required
for the Testcontainers-backed HTTP tests.

## Documentation site

`docs.davewil.dev` is the `apps/docs-hub` app plus the `cheatsheets/` cards, built into an
nginx image and fronted by caddy-docker-proxy (Cloudflare DNS). The prior static site
lingers on `docs-legacy.davewil.dev` as a rollback target. Content spans several domains —
Languages, Web & Runtime, Applied AI, Cloud Native, **Homelab**, Media/CLI tools.

**External citation URLs must be verified before commit** — see the citation workflow in
[CLAUDE.md](CLAUDE.md). A 404 makes the whole site look unmaintained.

## Conventions

- **Tests are split** `<thing>.test.ts` (scenario catalogue, `describe`/`it` only) +
  `<thing>.steps.ts` (self-contained step bodies). Full rules in [CLAUDE.md](CLAUDE.md).
- **Never `console.log`** in app code — use request-scoped `req.log` with structured objects.
- **New architectural deviations** need an ADR under `docs/adr/` and a STACK_DECISIONS entry.
