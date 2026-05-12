# Stack Decisions — Ledger

> **About this document.** Exploratory technical thinking, not a committed architecture. Picks are specific and opinionated because vague picks aren't useful for discussion — but each is a defensible choice among real alternatives, and happy to argue any of them. The categories and reasoning matter more than the exact packages.

A scannable reference for the technical choices made in [FUTURE_STACK_OPTIONS.md](FUTURE_STACK_OPTIONS.md) (the parent ecosystem survey) and [FUTURE_WEB_API_DEEP.md](FUTURE_WEB_API_DEEP.md) (the Web/API deep-dive on Fastify, auth, tenancy, audit, observability, contracts, and async workflows).

**Read this as the *what*; read the linked docs for the *why*.** When a row says "package X", the corresponding section in one of the linked docs explains the trade-off and the rejected alternatives.

Conventions used below:
- **Package picks** name a specific npm package the stack installs.
- **Conventions** (no package) name a pattern enforced by lint rules, ADRs, or the internal platform package — not something you install.
- **Anti-picks** name things explicitly ruled out, with brief reasons.

Last reviewed: 2026-05-11. Re-review on major Node LTS transitions, major Fastify/Zod releases, or yearly platform-package review.

---

## Runtime & build

- **Runtime**: Node 24 LTS (Active LTS since Oct 2025) — `node@24`
  - Node 22 still in Maintenance LTS through Apr 2027; fine for existing services until next planned upgrade.
- **Language**: TypeScript strict — `typescript`
- **Dev runner**: `tsx`
- **Bundler**: `tsup` or `esbuild`
- **TS config (convention)**: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- **Bun**: dev/test only; not production for regulated org yet. Re-evaluate yearly.
- **Deno**: out of scope.

## Web framework

- **HTTP framework**: Fastify — `fastify`
- **Edge runtime** (small slice, not paved road): Hono — `hono`
- **Route shape (convention)**: Action-Domain-Responder via `@org/server`'s `defineAction({ schemas, domain, requires })` helper
- **Fastify plugin set**:
  - `@fastify/sensible` — problem+json, `httpErrors`, `assert`
  - `@fastify/helmet` — security headers
  - `@fastify/cors`
  - `@fastify/cookie`, `@fastify/session`
  - `@fastify/rate-limit` — Redis-backed
  - `@fastify/compress` — Brotli/gzip; skip for streams
  - `@fastify/multipart`
  - `@fastify/under-pressure` — load shedding
  - `@fastify/circuit-breaker` (or `opossum` directly)
  - `@fastify/swagger`, `@fastify/swagger-ui`
  - `@fastify/request-context` — `AsyncLocalStorage` wrapper
  - `@fastify/jwt` (or roll OIDC explicitly via `jose`)
  - `@fastify/etag`, `@fastify/caching`
  - `fastify-graceful-shutdown`
- **Anti-picks**: Express, NestJS, Koa, Hapi, Express 5 — Fastify's hook taxonomy, schema-driven serialization, and Zod/Pino integration are decisive.

## Validation & schemas

- **Schema lib (universal)**: Zod 4 — `zod` (top-level `z.email()` / `z.uuid()` / `z.iso.datetime()` form; method-chained `z.string().email()` deprecated)
- **Fastify type provider**: `@fastify/type-provider-zod`
- **Error customization (Zod 4)**: `{ error: "..." }` (not `{ message: "..." }`)
- **Anti-picks**: TypeBox-only, io-ts, Joi, Yup, Ajv-hand-rolled — Zod gives compile-time + runtime safety from one declaration.

## Authentication & authorization

- **End-user SSO / SAML / SCIM**: WorkOS — `@workos-inc/node`, *or* Clerk — `@clerk/backend`
  - WorkOS for IT-buyer / self-serve IdP setup; Clerk for developer-led / built-in user UI.
- **JWT verify**: `jose` with cached JWKS
- **Session token mint**: KMS-signed internally; opaque refresh tokens in Redis
- **API-key hashing**: `argon2` (preferred) or `bcrypt`
- **Service-to-service**: Istio or Linkerd mesh (mTLS + SPIFFE); fallback to short-TTL KMS-signed JWTs
- **Webhook HMAC**: vendor SDKs (`stripe.webhooks.constructEvent` etc.) + raw-body capture
- **Fine-grained authz** (when needed): OpenFGA — `@openfga/sdk`, *or* Cerbos — `@cerbos/grpc`
- **Convention**: never propagate the IdP's JWT downstream — wrap it at the edge into your own short-lived JWT

## Multi-tenancy & request context

- **Async context**: `node:async_hooks` (`AsyncLocalStorage`) via `@fastify/request-context`
- **Request ID**: ULID via `ulid`
- **Trace context**: W3C `traceparent` header (OTel-managed)
- **Tenant enforcement (convention)**: layered — Postgres RLS + connection wrapper `SET LOCAL app.tenant_id` + Drizzle query predicate (belt-and-braces)
- **Idempotency**: Stripe pattern, Redis-backed (`ioredis`), keyed per-tenant
- **Per-tenant rate limit**: `@fastify/rate-limit` + Redis store, key = `${tenantId}:${routeBucket}`; LLM endpoints add a token-cost bucket

## Data layer

- **Postgres driver**: `postgres` (porsager) — tagged-template, SQL-injection-safe
- **ORM**: Drizzle — `drizzle-orm` + `drizzle-kit`
- **Edge Postgres**: `@neondatabase/serverless`
- **Cache / online state**: Redis via `ioredis`
- **In-process jobs**: BullMQ — `bullmq`
- **Vector** (default): `pgvector` Postgres extension via Drizzle integration; escalate to Qdrant Cloud at scale
- **Fast inner-loop tests**: PGlite — `@electric-sql/pglite`
- **Anti-picks**: Knex, Sequelize, TypeORM, `node-postgres` (`pg`) for new code

## Messaging

- **Cloud-native primary**: SQS via `@aws-sdk/client-sqs` + `sqs-consumer`
- **Kafka** (high-throughput agent fan-out): `@confluentinc/kafka-javascript` (KIP-848-capable)
- **Edge enqueue**: Cloudflare Queues / Upstash QStash (HTTPS — no specific npm package)
- **Schema registry** (only at language boundaries): Confluent / Apicurio / AWS Glue
- **Anti-picks**: Apache Pulsar (weak JS story), `node-rdkafka` (superseded), AMQP from edge runtimes

## Async workflows

- **Default**: queue + idempotent consumer + DLQ + idempotency keys
- **Step up**: saga *table* (custom; pattern in `@org/workflow` sub-package)
- **Workflow engine when justified**: Temporal — `@temporalio/client`, `@temporalio/worker`; Inngest — `inngest`; AWS Step Functions
- **Durable-execution-as-runtime watch list**: Restate, DBOS, Cloudflare Durable Objects + Workflows
- **In-flight schema evolution (convention)**: `EventEnvelope` (`{ schemaVersion, payload }`) + in-process upcasters defined in `@org/contracts`

## Audit logging

- **Tier 1 (default)**: `audit_events` table written in the request transaction — no extra package
- **Tier 2**: PG + async shipper to S3 (`@aws-sdk/client-s3`) or Azure Immutable Blobs (`@azure/storage-blob`)
- **Tier 3**: transactional outbox + Kafka — only when multi-consumer / SIEM / customer webhook fan-out justifies it
- **Retention**: table partitioning via `pg_partman` (DB extension, not npm); object-lock retention on cold sink
- **Convention**: never `await kafka.send(event)` inside a request transaction without DB-side persistence

## Structured logging

- **Logger**: Pino — `pino` (built into Fastify)
- **Pretty-print (dev only)**: `pino-pretty`
- **Transport**: `pino.transport()` to worker thread for prod log shipping
- **Conventions (lint-enforced)**: no `console.log`, no string-interpolation logging, no full-body logging (hash if correlation needed)

## Observability

- **Tracing/metrics SDK**: `@opentelemetry/sdk-node`
- **Auto-instrumentation**: `@opentelemetry/auto-instrumentations-node`
- **Exporter**: `@opentelemetry/exporter-trace-otlp-http`
- **LLM-aware spans**: `@arizeai/openinference-instrumentation-fastify` (plus OpenAI / Anthropic / LangChain OpenInference instrumentations)
- **LLM-specific UX**: Langfuse — `langfuse` (self-host in-VPC for regulated data)
- **Eval gates in CI**: `promptfoo`

## LLM / agent layer

- **Anthropic**: `@anthropic-ai/sdk`
- **OpenAI + Azure OpenAI**: `openai` (use `AzureOpenAI` class)
- **Gemini / Vertex Gemini**: `@google/genai`
- **Embeddings**: Voyage — `voyageai` (Anthropic-recommended)
- **Orchestration (default)**: Vercel AI SDK — `ai`
- **Long-running / branching agents**: `@langchain/langgraph`
- **Higher-level agent framework (optional)**: `mastra`
- **Internal coding/automation agents**: `@anthropic-ai/claude-agent-sdk`
- **Tool interop**: `@modelcontextprotocol/sdk`
- **Tokenizers**: `tiktoken`, `gpt-tokenizer`, `@anthropic-ai/tokenizer`
- **Effect-TS for agent orchestration**: watch-list (`effect`, `@effect/ai`) — not in current paved road
- **Convention**: prompt caching (`cache_control`) wherever system prompt or tenant context exceeds a few KB

## Outbound HTTP

- **Client**: `undici` (the fetch impl in Node 24)
- **Lightweight AWS SigV4**: `aws4fetch`
- **Anti-picks**: axios, got, superagent — undici's connection pooling is decisive

## Testing

- **Test runner**: Vitest — `vitest`
- **Property-based**: `@fast-check/vitest`
- **Integration (real deps)**: Testcontainers — `@testcontainers/postgresql`, `@testcontainers/redis`, `@testcontainers/kafka`
- **Fast inner-loop PG**: `@electric-sql/pglite`
- **E2E**: Playwright — `@playwright/test`
- **Prompt eval gates**: `promptfoo`
- **Cross-language / external contract testing**: Pact — `@pact-foundation/pact` (only at org or language boundaries)
- **In-org TS-to-TS contracts (convention)**: compiler-as-contract-test + Renovate fan-out + `defineEvent` upcasters — no Pact required

## Multi-tenant isolation patterns (conventions)

- Pool model with hard fences; per-tenant schema or RLS in PG; per-tenant prefix in Redis / OpenSearch / object storage
- Per-tenant KMS key — `@aws-sdk/client-kms` / `@azure/keyvault-keys` / `@google-cloud/kms`
- Audit trail data residency: region-pinned via tenant attribute
- Append-only `audit_events` topic in Kafka (Tier 3) → OpenSearch + cold storage with object-lock retention

## Platform package shape (org's internal `@org/*` family)

- `@org/contracts` — Zod schemas, `EventEnvelope`, `defineEvent({ name, schemas, upcast })`
- `@org/server` — Fastify factory `buildApp()`, `defineAction()` helper
- `@org/auth` — JWT mint/verify, JWKS cache, capability tokens, WorkOS/Clerk adapters
- `@org/tenancy` — ALS context spine, RLS helpers, fast-check generators
- `@org/db` — `postgres` + Drizzle setup, migration runner, RLS policy generator
- `@org/audit` — table migration + Zod schemas; optional Tier 2/3 sub-modules
- `@org/observability` — Pino + OTel + OpenInference wiring as one import
- `@org/messaging` — SQS / Kafka / BullMQ wrappers; auto-upcast + idempotency
- `@org/llm` — Anthropic / OpenAI / Gemini clients, prompt-caching defaults, AbortSignal plumbing
- `@org/workflow` (optional) — typed state-machine helper for saga-table pattern
- `@org/testing` — Testcontainers harness, fast-check arbitraries
- `@org/eslint-config` — lints: no `console.log`, no raw `fetch`, no `req.headers` reads in handlers, no `.strict()` on event schemas, no `fastify` imports under `src/domain/**`, every `src/routes/**` file exports a `defineAction()`
- `@org/tsconfig` — strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes

## Monorepo & release

- **Workspace**: `pnpm` workspaces, Turborepo (`turbo`), or Nx
- **Versioning**: single-version monorepo via Changesets (`@changesets/cli`) in fixed mode
- **Update fan-out**: Renovate (or Dependabot)
- **Migration codemods**: `jscodeshift` or `ast-grep`
- **Registry**: GitHub Packages, JFrog Artifactory, Verdaccio, or npm Pro
- **Provenance / signing**: npm `--provenance` or Sigstore

## Auth / secrets at infra level

- **Cloud creds (unified façade)**: `@aws-sdk/credential-providers`, `@azure/identity`, `google-auth-library` behind a single `cloudCredential()` factory
- **Secrets**: cloud-native (AWS Secrets Manager / Azure Key Vault / GCP Secret Manager)
- **OIDC federation in CI/CD**: `aws-actions/configure-aws-credentials`, `azure/login`, `google-github-actions/auth`

## Anti-picks (explicit removals, with reasons)

- `aws-sdk` v2 — replaced by modular `@aws-sdk/*` v3
- Sequelize, TypeORM, Knex — Drizzle wins on types and SQL honesty
- `@azure/openai` — deprecated; use `openai` package with `AzureOpenAI` class
- Apache Pulsar — weak JS client story
- LangChain.js non-LangGraph parts — use LangGraph specifically, or Mastra / Vercel AI SDK
- Pact for in-org TS-to-TS contracts — compiler + Renovate fan-out subsumes it
- Self-built voice agents — use LiveKit Agents or OpenAI Realtime
- Multi-cloud abstraction layers — pick one cloud as home, abstract only auth
- NestJS — too much ceremony for a Fastify-shaped problem
- axios / got / superagent — use `undici` directly
- `console.log` anywhere in app code — lint-rule it
- String-interpolation log messages — pass structured objects

## Things to verify before committing each major version

(From [FUTURE_WEB_API_DEEP.md](FUTURE_WEB_API_DEEP.md) §12.)

- `@fastify/type-provider-zod` Zod 4 compatibility
- `@fastify/request-context` interaction with streaming responses (SSE keeps ALS alive past `onResponse`)
- `@arizeai/openinference-instrumentation-fastify` coverage of streaming LLM responses
- WorkOS / Clerk SCIM event delivery semantics (at-least-once → audit pipeline idempotent)
- OpenFGA vs Cerbos for the chosen tenancy model
- Pino transport behaviour under k8s log rotation
- `onRequestAbort` reliability under your reverse-proxy / load-balancer combination
- Web Streams `Response` / `ReadableStream` payload support in `onSend` across third-party Fastify plugins
- `fastify-plugin` wrapping rules for any plugin that needs to publish decorators across scopes

---

## How to use this file

- **New service kickoff**: `pnpm add` the relevant rows; the platform package (`@org/server`) pulls the cross-cutting ones transitively.
- **Architecture review**: cross-check the codebase against this ledger; any deviation should have a written ADR (Architecture Decision Record, not the routing pattern) in `docs/adr/`.
- **Hiring / onboarding**: this is the technical-stack handout. Two minutes to scan, two days to be productive against the platform package.
- **AI coding-assistant context**: bundle this file plus the long-form docs into the assistant's project knowledge (`CLAUDE.md`, `.cursor/rules/`). The assistant generates code that matches the picks instead of inventing alternatives.
