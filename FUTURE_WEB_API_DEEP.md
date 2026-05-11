# Web / API Layer — Deep Dive

Companion to [FUTURE_STACK_OPTIONS.md](FUTURE_STACK_OPTIONS.md) §6 ("Web / API"). Where the parent doc gives the headline pick (Fastify + Zod), this one drills into the *per-request* mechanics that matter for a regulated, multi-tenant, agentic platform: authentication, tenant resolution, request-scoped context, audit, structured logging, observability, and performance.

Audience: someone evaluating whether the recommended stack actually composes into a coherent request lifecycle, and wanting to see the seams.

### Why this doc has the shape it does — the "paved road" motivator

At enterprise scale, the architectural decisions in this doc only matter if they're *delivered to teams as code*, not as a wiki page. The implicit endpoint of this whole survey is an internal **paved-road platform package** — typically an `@org/server` family of packages plus a `create-org-service` template repo — that bakes in every cross-cutting concern (auth, tenancy, audit, logging, tracing, rate-limiting, error shape, graceful shutdown) so that a new service starts at the *handler signature*, not at `Fastify()`.

Reading this way, every section below is a chapter spec for what that platform package needs to ship. §10 makes the package layout concrete; §1–§9 are the contents; §11 covers the failure mode the platform must survive — async workflows where contracts evolve under in-flight messages.

Three reasons an enterprise pays the up-front cost of building this:

1. **Consistency by construction.** Two services written six months apart by different teams have identical request lifecycles, identical log shapes, identical tenant boundaries, identical audit semantics. Audits, runbooks, and SRE on-call rotations can assume one model.
2. **Single upgrade lever.** When OTel ships a breaking change, when Zod 4 reshapes errors, when a CVE lands in `@fastify/cookie`, you bump one package version. Renovate fans out PRs across every service; CI catches incompatibilities; the org is patched in days, not quarters.
3. **Time-to-first-endpoint compresses.** A new microservice goes from "two weeks of plumbing" to "an afternoon of business logic" — and that afternoon's code has the same security posture as production code that's been hardened for years.

---

## 0. Mental model — the Fastify request lifecycle as the cross-cutting backbone

Fastify exposes **ten request/reply hooks** and **six application-lifecycle hooks**. Almost every cross-cutting concern in this stack ends up wired into one of them; naming them up front makes the rest of the doc easier to map.

```
client ──HTTP──▶  ┌──────────────────────────────────────────────────┐
                  │ Routing          (route match, 404 branch)        │
                  │ onRequest        ← request id, OTel span, ALS run │
                  │ preParsing       ← raw-body capture, size guard   │
                  │ Body parsing                                      │
                  │ preValidation    ← auth, tenant resolve           │
                  │ Schema validation← Zod / TypeBox (400 on fail)    │
                  │ preHandler       ← rate limit, idempotency, RLS   │
                  │ ─── handler ───                                   │
                  │ preSerialization ← redact + ETag (NOT on streams) │
                  │ onSend           ← compression, headers           │
                  │ Outgoing response                                 │
                  │ onResponse       ← audit emit, req.complete log   │
                  │                                                   │
                  │   onError        ← telemetry on thrown errors     │
                  │   onTimeout      ← connectionTimeout (socket)     │
                  │   onRequestAbort ← client disconnect mid-request  │
                  └──────────────────────────────────────────────────┘
                                │
                                ▼
                       Pino logger ─▶ collector ─▶ Loki / OpenSearch
                       OTel SDK   ─▶ collector ─▶ Tempo / Honeycomb / Langfuse
                       Audit bus  ─▶ Kafka      ─▶ S3 (object-locked) + OpenSearch
```

App-lifecycle hooks (fired outside any request): `onReady` (just before `listen`), `onListen` (after `listen`, *not* fired by `inject()`/`ready()`), `preClose` (before HTTP server stops accepting; encapsulated), `onClose` (after HTTP server stopped; **not** encapsulated — runs globally), `onRoute` (sync, plugin instrumentation), `onRegister` (sync, fires when a child plugin scope is created — does **not** fire if the plugin is wrapped in `fastify-plugin`).

Three principles that fall out of this:

1. **Hooks compose; middleware doesn't.** Express-style `(req, res, next)` flattens everything into one chain. Fastify's named hooks let you place a concern at the *correct* phase (e.g. tenant resolution must run *before* validation if your schemas are tenant-scoped). Express-style middleware is not built in since v3 — it requires `@fastify/express` (full compat) or `@fastify/middie` (subset, faster); per the docs, "Fastify middleware does not expose the `send` method", so prefer `preHandler` for any new code.
2. **The handler should do as little cross-cutting work as possible.** If a handler reaches into headers for `x-tenant-id` or constructs its own request id, the abstraction has leaked. Aim for handlers that read `req.ctx.tenantId` and nothing else.
3. **`preSerialization` is skipped for string / Buffer / stream / null payloads.** That means SSE, file streams, and streaming-LLM responses do *not* get hook-based redaction. Anything that must transform the bytes of a streamed body has to do it at the chunk writer — not in `preSerialization` or `onSend`. (`onSend` *is* invoked, but its payload is the stream itself, not the chunks.)

---

## 1. Framework picks — why Fastify, what's been ruled out

### Fastify (Node target — primary)

- **Why it wins for this stack**: schema-driven serialization (`fast-json-stringify`) gives ~2× JSON throughput vs Express; encapsulation contexts (every plugin gets its own DI scope) make multi-tenant isolation testable; first-class Pino integration; `@fastify/type-provider-zod` and TypeBox provider make types flow from HTTP boundary into handlers without manual generics.
- **Plugin ecosystem to standardize on (per-request concerns):**
  - `@fastify/sensible` — `httpErrors`, `assert`, problem+json shapes.
  - `@fastify/helmet` — security headers.
  - `@fastify/cors` — CORS.
  - `@fastify/cookie` + `@fastify/session` (or stateless JWT — see §2).
  - `@fastify/rate-limit` — token-bucket rate limiting backed by Redis.
  - `@fastify/compress` — Brotli/gzip; skip for streaming responses.
  - `@fastify/multipart` — uploads with backpressure; pair with `@fastify/swagger` for docs.
  - `@fastify/under-pressure` — load shedding (event loop delay, RSS, heap).
  - `@fastify/circuit-breaker` — per-route circuit breakers (or use `opossum` directly).
  - `@fastify/swagger` + `@fastify/swagger-ui` — OpenAPI from Zod/TypeBox schemas.
  - `@fastify/request-context` — `AsyncLocalStorage`-backed request scope (see §3).
  - `@fastify/jwt` — JWT verification (or roll OIDC explicitly — see §2).
  - `@fastify/etag`, `@fastify/caching` — cache control.
  - `fastify-graceful-shutdown` — drain on SIGTERM.

> **Note on edge runtimes.** If a small slice of the surface needs Workers / Vercel Edge (e.g. token introspection cache, regional routing), Hono is the conventional pick — but it sits outside the paved road in this doc. Treat any edge surface as a separate runtime that consumes the same `@org/contracts` Zod schemas and writes to the same audit bus over HTTPS; don't try to make `@org/server` itself edge-portable.

### tRPC (Internal admin UIs only)

- Use only where client and server are co-deployed and co-versioned. The moment a third party (mobile app, partner integration, support tool) needs the same surface, switch to OpenAPI-from-Zod via Fastify.

### Anti-picks (with reasons)

- **Express** — fine, but Fastify gives you almost-the-same DX with materially better perf, better hook taxonomy, and Zod/Pino integration baked in. Express middleware is one chain; Fastify hooks are a graph. The graph wins for cross-cutting work.
- **NestJS** — too much ceremony (modules, providers, guards, interceptors, pipes, filters) for a Fastify-shaped problem. NestJS over Fastify mostly buys decorators and DI, both of which a small `@org/server` plugin set replicates with less magic.
- **Koa / Hapi** — Koa has been quiet for years; Hapi is fading. Choose Fastify.
- **Express 5** — even with the long-awaited release, the ecosystem inertia is on Fastify for new TS work.

★ Insight ─────────────────────────────────────
- Fastify's **encapsulation contexts** are an under-appreciated multi-tenant feature: registering a plugin under `app.register(plugin, { prefix: '/v2' })` creates a fresh DI scope with its own decorators, hooks, and error handlers. You can mount a "v2 with stricter auth" subtree without forking the whole app.
- `fast-json-stringify` only kicks in if you declare a response schema. Skip the schema and you fall back to `JSON.stringify` and lose half the speed advantage. *Schema-or-pay* is the deal.
─────────────────────────────────────────────────

---

## 2. Authentication & Authorization

There are at least four different auth surfaces in a regulated B2B agent platform. They want different tools.

| Surface | Who/what is calling | Recommended primitive |
|---|---|---|
| **End-user (browser)** | Human via SSO/SAML/OIDC | WorkOS or Clerk + short-lived session JWT in HttpOnly cookie + refresh via silent OIDC |
| **Programmatic API** | Customer's backend | API key (prefixed, hashed) → tenant-scoped session token |
| **Service-to-service** | Internal microservices | mTLS via service mesh (Istio/Linkerd) + SPIFFE identities; or signed JWTs with short TTL |
| **Webhook ingress** | Third-party (Stripe, GitHub, etc.) | Per-source HMAC verification; replay-window check |
| **Agent tools (MCP)** | LLM agents calling tools | Scoped, capability-based tokens; never the user's session token |

### 2.1 End-user auth — the WorkOS / Clerk decision

Both deliver enterprise SSO/SAML/SCIM, both have solid Node SDKs (`@workos-inc/node`, `@clerk/backend`). Pick by buyer profile:

- **WorkOS** — buyer-led, lower-magic. Better when your customers are IT departments who want to self-serve their IdP setup. SCIM provisioning is first-class.
- **Clerk** — developer-led, higher-magic. Better when you want UI components, organization switching, and built-in user management UI. SCIM is available but heavier to configure.

**Pattern that works for both**:

1. SDK runs the OIDC handshake; you receive a verified user identity + organization (= tenant).
2. You mint your *own* short-lived session JWT (5–15 min) signed by your KMS key, containing `{ sub, tenant_id, scopes, jti }`. Never pass the IdP's JWT around internally — wrap it.
3. Refresh via silent OIDC re-authentication or a longer-lived opaque refresh token in Redis.
4. Logout invalidates the `jti` (Redis denylist with TTL = remaining JWT lifetime).

```ts
// app.register(authPlugin, { issuer: 'auth.example.com' })
fastify.addHook('preValidation', async (req) => {
  const token = extractBearerOrCookie(req);
  if (!token) throw req.server.httpErrors.unauthorized();
  const claims = await verifyJwt(token, jwks); // jose, cached JWKS
  if (await deniedJtiCache.has(claims.jti)) {
    throw req.server.httpErrors.unauthorized('session revoked');
  }
  req.ctx.user = { id: claims.sub, scopes: claims.scopes };
  req.ctx.tenantId = claims.tenant_id;
});
```

### 2.2 Programmatic API keys

Standard pattern:

- Display once, store as `bcrypt(api_key)` (or `argon2id`), with a non-secret prefix (`sk_live_…`, `sk_test_…`) to allow lookup.
- Lookup by prefix → verify hash → mint a short-lived internal JWT (same shape as user JWT, but with `sub: 'api_key:<id>'`).
- Rate-limit per key, not per IP.
- Rotate via overlapping validity windows (old + new both work for N hours).

### 2.3 Service-to-service

If you're already running Kubernetes with Istio/Linkerd, use the mesh:

- mTLS by default; identities via SPIFFE.
- Per-tenant authorization policies via mesh CRDs.
- Application code reads the verified peer identity from a mesh-injected header.

If you don't yet have a mesh, signed short-TTL JWTs (issued by an internal STS, signed with KMS) work fine. The trap is letting service tokens become long-lived — set TTL ≤ 5 minutes and refresh.

### 2.4 Webhook ingress — the bit everyone gets wrong

```ts
fastify.post('/webhooks/stripe', {
  config: { rawBody: true },               // need raw body for HMAC
  preParsing: async (req, _reply, payload) => payload, // skip JSON parse
}, async (req, reply) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.rawBody, sig, secret);
  // event.id is unique → idempotency key (see §4.4)
  await idempotency.runOnce(`stripe:${event.id}`, () => process(event));
  return reply.code(200).send();
});
```

Three failure modes to bake into tests:

- **Replay**: signed payloads accepted forever. Fix: enforce timestamp window (≤5 min skew) and persist `event.id` for the retention window.
- **Mass-assignment**: webhook payload is trusted because the signature is valid → updates fields the user shouldn't control. Fix: validate against a Zod schema *before* writing.
- **Tenant ambiguity**: a webhook for tenant A is processed under tenant B's context because the route doesn't carry tenancy. Fix: webhook routes resolve tenant from the *signed payload*, never from headers/cookies.

### 2.5 Authorization layers

Authentication answers "who". Authorization answers "are you allowed". Three layers, all needed:

1. **Coarse-grained (route-level scopes)** — `requires('reports:read')`. Implemented as a `preHandler` hook checking `req.ctx.user.scopes`.
2. **Tenant boundary (data-plane)** — every query is tenant-scoped. Enforced by Postgres RLS + a Drizzle middleware that adds `where tenant_id = $current` (belt-and-braces — see §4.2).
3. **Fine-grained (resource ABAC/ReBAC)** — for "user X can see report Y because they're on team Z". Tools: **OpenFGA** (Zanzibar-style, OSS), **Cerbos** (policy-as-code), or AWS Verified Permissions. For small surfaces, plain SQL joins beat introducing a policy engine.

★ Insight ─────────────────────────────────────
- The most common architectural mistake here is *trusting the IdP's JWT all the way down the call graph*. Wrap it at the edge into your own short-lived JWT. Then tenant_id, scopes, and revocation are *yours* to control — not the IdP's release schedule.
- Capability tokens for agent tool-calls are the under-appreciated piece. When an LLM calls a tool, the token presented should grant *only* the operation needed (e.g. "read invoice 123 for tenant T") — not the user's full session. This is what makes prompt injection survivable.
─────────────────────────────────────────────────

---

## 3. Request-scoped context — the spine of every cross-cutting concern

Every cross-cutting concern (logging, audit, tracing, RLS, rate limit, LLM-cost attribution) needs the same five values: `request_id`, `trace_id`, `tenant_id`, `user_id`, `started_at`. Make these *implicitly* available everywhere, or you'll be passing them through call signatures forever.

The mechanism is `node:async_hooks.AsyncLocalStorage`. Fastify's `@fastify/request-context` wraps it.

```ts
import { AsyncLocalStorage } from 'node:async_hooks';

interface ReqCtx {
  requestId: string;     // ULID, generated onRequest if absent
  traceparent: string;   // W3C; from header if present, else minted
  tenantId: string | null;
  userId: string | null;
  startedAt: number;
  // Loose bag for handlers to add things; never read from outside
  extras: Map<string, unknown>;
}

export const ctxStore = new AsyncLocalStorage<ReqCtx>();
export const ctx = (): ReqCtx => {
  const c = ctxStore.getStore();
  if (!c) throw new Error('called outside request scope');
  return c;
};

fastify.addHook('onRequest', (req, _reply, done) => {
  const c: ReqCtx = {
    requestId: req.headers['x-request-id'] as string ?? ulid(),
    traceparent: req.headers.traceparent as string ?? mintTraceparent(),
    tenantId: null,
    userId: null,
    startedAt: performance.now(),
    extras: new Map(),
  };
  ctxStore.run(c, done);
});
```

Once this is in place:

- `pino` child logger reads `ctx()` via a `mixin`, so every log line auto-includes the IDs.
- The Postgres connection pool's `pool.query` wrapper calls `SET LOCAL app.tenant_id = ${ctx().tenantId}` so RLS sees the right tenant even from worker code that never saw the HTTP request.
- The OTel span auto-includes `tenant.id` and `user.id` as attributes.
- The audit emitter pulls the same fields without parameters.

### Pitfalls

- **Lost context across `setImmediate` / event emitters / child workers**: ALS *does* propagate across promises and `await`, but breaks across `worker_threads` and across process boundaries (queues). At the boundary, *serialize* the context into the message envelope (`X-Request-Id`, `traceparent`, `Tenant-Id`) and rebuild on the consumer side.
- **`pg-pool` and ALS**: pool callbacks don't always inherit ALS in all driver versions — verify with a test. The `postgres` (porsager) driver is well-behaved here.
- **Streaming responses**: ALS lives until the stream closes; ensure the `onResponse` hook doesn't fire prematurely or you'll drop trailing audit events. Also: `preSerialization` is skipped for streams, so any redaction must happen at the chunk writer.
- **Client disconnect mid-stream → wasted LLM cost**: wire `onRequestAbort` to propagate an `AbortSignal` into the in-flight LLM call. For an Anthropic/OpenAI streaming completion that's been running for 10s on Opus, cancelling at the upstream saves the remaining output tokens. The Fastify docs note `onRequestAbort` detection is *"not completely reliable"* — treat it as best-effort cost protection, not a correctness mechanism.
- **`reply.hijack()` for SSE / WebSocket upgrade**: bypasses remaining hooks and Fastify's auto-response. Required for genuinely long-lived streaming surfaces, but be aware that you take over responsibility for `onResponse`-equivalent audit emission. `reply.raw` writes still trigger `onResponse`; `reply.hijack()` does not.

---

## 4. Multi-tenancy — making it a property of the data plane, not a wrapper

The doc's principle 3 ("Tenancy is a property of the data plane, not a wrapper") needs concrete mechanisms.

### 4.1 Tenant resolution

Where does `tenant_id` come from? Pick *one* source per surface and make it absolute.

| Surface | Resolution source |
|---|---|
| End-user web/API | JWT claim `tenant_id` (signed by you, see §2.1) |
| Programmatic API key | Key → tenant lookup at auth time |
| Webhook | Signed payload field; never headers |
| Internal service-to-service | Header `X-Tenant-Id` *only if* mesh authorizes the caller to assert it |
| Worker/job | Job envelope; never inferred |

Anti-patterns:

- Subdomain-based resolution (`tenantA.app.example.com`) — works, but mixes auth (cookie scope) with routing in a way that hurts cookie security; pick path-based or header-based instead.
- Resolving from `Origin` / `Referer` — unauthenticated headers, easy to spoof.

### 4.2 Tenant enforcement at the DB

Layered defense:

```ts
// 1. Postgres RLS — last line of defense
//   alter table invoices enable row level security;
//   create policy invoices_tenant on invoices using
//     (tenant_id = current_setting('app.tenant_id')::uuid);

// 2. Connection wrapper — sets the GUC per checkout
const withTenant = async <T>(fn: (sql: Sql) => Promise<T>): Promise<T> => {
  return sql.begin(async (tx) => {
    await tx`set local app.tenant_id = ${ctx().tenantId}`;
    return fn(tx);
  });
};

// 3. Drizzle query helper — adds explicit predicate (belt-and-braces)
const tenantQuery = <T>(qb: QB<T>) => qb.where(eq(table.tenantId, ctx().tenantId));
```

Why three layers and not one?

- RLS alone is correct but produces silent zero-row results when the GUC is unset — easy to miss in tests.
- Explicit `where` alone is correct but a refactor can drop it without anyone noticing.
- Together they fail loudly *and* defensively, and you can prove (via property-based tests with `@fast-check/vitest`) that any query without the predicate returns zero rows.

### 4.3 Tenant-scoped connection pools — to share or not

For ≤ ~10k tenants on a shared cluster, **one shared pool** with `SET LOCAL app.tenant_id` per transaction is the right answer. Pool-per-tenant doesn't scale (Postgres connections cost ~10MB each) and produces thundering-herd reconnection storms.

For very large enterprise tenants with their own DB (data-residency or contract-mandated isolation), use a *router* pattern: a small in-memory map from `tenant_id` → connection-string lookup, and per-DB pools created lazily with idle eviction.

### 4.4 Idempotency — Stripe pattern

Tenants retry. You must dedupe.

```ts
// preHandler hook on POST/PUT/PATCH endpoints that accept Idempotency-Key
fastify.addHook('preHandler', async (req, reply) => {
  const key = req.headers['idempotency-key'];
  if (!key || !MUTATING.has(req.method)) return;
  const stored = await redis.get(`idem:${ctx().tenantId}:${key}`);
  if (stored) {
    const { status, body } = JSON.parse(stored);
    return reply.code(status).send(body);
  }
  // Mark in-flight; compare body hash to detect "same key, different payload"
  const bodyHash = hash(req.body);
  await redis.set(`idem:${ctx().tenantId}:${key}:hash`, bodyHash, 'EX', 86400, 'NX');
});

fastify.addHook('onSend', async (req, reply, payload) => {
  const key = req.headers['idempotency-key'];
  if (key && MUTATING.has(req.method) && reply.statusCode < 500) {
    await redis.set(
      `idem:${ctx().tenantId}:${key}`,
      JSON.stringify({ status: reply.statusCode, body: payload }),
      'EX', 86400,
    );
  }
  return payload;
});
```

Three subtleties:

- Scope idempotency keys per tenant (collisions across tenants must be impossible).
- Reject same-key/different-payload with `409 Conflict`.
- Don't cache 5xx — those need to be retryable.

### 4.5 Per-tenant rate limiting

`@fastify/rate-limit` + Redis store, key = `${tenantId}:${routeBucket}`. Implement two buckets:

- **Burst** — short window (1s), high allowance, protects from accidental loops.
- **Quota** — daily/monthly window, plan-aligned, returns `X-RateLimit-Reset` headers.

For LLM-fronting endpoints, also rate-limit by *cost units* (input tokens × model price), not just request count, or one tenant calling Opus in a loop will eat your budget.

★ Insight ─────────────────────────────────────
- The strongest tenancy invariant you can write isn't "every query has tenant_id" — it's a **property-based test** that says: "for any sequence of API calls by tenant A, no row read or written has tenant_id ≠ A". `@fast-check/vitest` makes this practical. Run it in CI on every PR. It catches the vast majority of "I forgot the where clause" bugs at the type/test level rather than RLS-level.
- Idempotency keys are *also* an audit-trail seed. Persisting them with TTL = 24h gives you free deduplication on customer retries *and* a per-tenant "recent activity" view for support, both at near-zero extra cost.
─────────────────────────────────────────────────

---

## 5. Audit logging — separate from observability

Audit logs and observability logs are *different things*. Mixing them costs you on retention, redaction, and queryability.

| | Audit log | Observability log |
|---|---|---|
| **Purpose** | "what did the user do" — compliance, forensics | "what did the system do" — debugging, perf |
| **Retention** | Years (often 7) | Days to weeks |
| **Sink** | Append-only, object-locked (S3 + Glacier; Azure immutable blobs) | Loki / OpenSearch; rotating |
| **Schema** | Strict, versioned, validated | Loose, free-form |
| **Volume** | Low (one per business action) | High (one per debug line) |
| **Producer** | Application code, explicit | Pino, automatic |

### Audit event schema (versioned)

```ts
const AuditEvent = z.object({
  schemaVersion: z.literal(1),
  eventId: z.string().ulid(),
  occurredAt: z.string().datetime(),
  tenantId: z.string().uuid(),
  actor: z.object({
    type: z.enum(['user', 'api_key', 'service', 'system']),
    id: z.string(),
    sessionId: z.string().optional(),
  }),
  action: z.string(),                 // 'invoice.created', 'agent.tool.called'
  resource: z.object({
    type: z.string(),                 // 'invoice'
    id: z.string(),
  }).optional(),
  request: z.object({
    requestId: z.string(),
    traceId: z.string(),
    ip: z.string().optional(),
    userAgent: z.string().optional(),
  }),
  outcome: z.enum(['success', 'denied', 'error']),
  // Hash of input params; full params in cold storage if needed
  paramsHash: z.string(),
  // Diff for state-changing actions (small, structured)
  changes: z.array(z.object({
    field: z.string(),
    before: z.unknown(),
    after: z.unknown(),
  })).optional(),
});
```

### Delivery — pick the simplest tier that meets your requirements

There are three tiers of audit delivery; **most teams should start at Tier 1 and only escalate when a concrete requirement forces the move**. The transactional-outbox pattern is genuinely useful but brings real operational surface (Kafka cluster, dispatcher worker, partition keys, idempotent consumers, sometimes a schema registry). Don't pay for it by default.

**Tier 1 — Postgres-only (default)**

In the same DB transaction as the business write, `INSERT INTO audit_events (...)`. That's it. Query it with SQL. Retain via table partitioning (`pg_partman` monthly partitions, drop or archive partitions older than your retention window). Single source of truth, no second system, no eventual-consistency window.

```ts
await sql.begin(async (tx) => {
  await tx`insert into invoices ...`;
  await tx`insert into audit_events ${sql({ ...auditRow })}`;  // same tx
});
```

Choose this when:
- One consumer of audit data (your own SQL queries, the support tool, the customer-facing audit UI).
- Volume is "one row per business action" — usually thousands/day per tenant, not millions.
- "If the DB is down, we're down anyway" is acceptable.

This is *most regulated B2B SaaS*. Don't overshoot it.

**Tier 2 — Postgres + async shipper to cold storage**

Same as Tier 1, plus a small worker that reads `audit_events WHERE shipped_at IS NULL`, writes to S3 (object-lock) or Azure immutable blob, and updates `shipped_at`. If the shipper falls behind or crashes, no data is lost — the rows are in Postgres. This is *not* the outbox pattern; it's a follower over a durable table.

Choose this when:
- You have a compliance retention requirement that exceeds what you want to hold in PG (years).
- You want a write-once / object-locked sink for legal hold.
- You still have one *application* consumer (PG); the other "consumer" is just cold storage.

**Tier 3 — Transactional outbox + Kafka (only when you need it)**

Insert into `audit_outbox` in the business transaction; dispatcher streams to Kafka; multiple consumers (S3, OpenSearch, SIEM, customer webhooks, real-time analytics) subscribe. This is the full pattern.

Escalate to Tier 3 when **at least one** is true:
- Multiple downstream systems consume audit events with their own ordering/replay needs.
- A SIEM (Splunk, Datadog Cloud SIEM) or external compliance tool needs streaming delivery.
- You ship customer-facing audit webhooks (each tenant gets their own audit feed).
- You already run Kafka for other domains, so the marginal cost is low.
- You need event-sourced agent traces (the §6 deterministic-replay table is a good Tier-3 candidate independently of business-domain audit).

Operational cost to be honest about, before adopting Tier 3:
- A Kafka cluster (or Confluent Cloud bill) and the on-call rotation that comes with it.
- A dispatcher worker with offset tracking, retries, dead-letter handling.
- Idempotent consumers (events are at-least-once).
- A schema strategy (Avro + registry, or versioned Zod schemas) and a forwards/backwards compatibility policy.
- Partition-key choice that doesn't accidentally serialise all of a tenant's traffic to one partition.

In all three tiers, the invariant is the same: **no business write without an audit row, no audit row without the business write succeeding.** Tier 1 gets that for free from a DB transaction; Tier 2 inherits it; Tier 3 needs the outbox specifically *because* Kafka is outside the transaction.

The anti-pattern across all tiers: `await kafka.send(event)` inside a request handler with no DB-side persistence. That's the worst of all worlds — Kafka unavailability fails business writes *and* loses audit events without trace. If you're tempted by it because Tier 3 feels heavy, the answer is Tier 1, not direct emit.

### What to redact

- Passwords, API keys, JWTs, OAuth tokens, MFA codes — **never** in audit logs.
- PII (email, name, phone) — encrypt with tenant CMK if storing; hash + last-4 if not.
- Free-text fields that may contain PII (search queries, comments) — store the hash, store the full text in a separately-encrypted blob with a different access policy.
- LLM prompts/completions — separately classified data; audit them, but in their own pipeline (Langfuse → in-VPC PG) with short retention by default.

★ Insight ─────────────────────────────────────
- The single highest-leverage move from §6 of the parent doc is the **deterministic-replay table** for LLM/agent calls. Make it a *typed audit subtype* (`action: 'agent.call', changes: ...`) so customer audits and engineering postmortems share the same query surface.
- Audit-log immutability is a property of the *sink*, not the producer. S3 Object Lock (compliance mode) / Azure immutable blob policy / GCS bucket retention are the actual safeguards. Application-side "do not delete" comments are not safeguards.
─────────────────────────────────────────────────

---

## 6. Structured logging — Pino, with discipline

Fastify ships with Pino. Use it; don't fight it.

### Baseline configuration

```ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) => ({ level: label }),  // 'info' not 30
  },
  // Auto-attach request-scoped context to every log line
  mixin() {
    const c = ctxStore.getStore();
    return c ? {
      requestId: c.requestId,
      traceId: extractTraceId(c.traceparent),
      tenantId: c.tenantId,
      userId: c.userId,
    } : {};
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      '*.password',
      '*.token',
      '*.secret',
      '*.creditCard',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    req: pino.stdSerializers.wrapRequestSerializer((r) => ({
      method: r.method,
      url: r.url,
      route: r.routeOptions?.url,        // template, not concrete path
    })),
    err: pino.stdSerializers.err,
  },
});
```

### Conventions that pay back

- **One event per request, plus exceptions.** A `req.complete` event in `onResponse` with `{ method, route, status, duration_ms, db_ms, llm_ms, db_calls, llm_tokens }` is more useful than 30 noisy lines.
- **Structured `event` field.** `logger.info({ event: 'agent.tool.called', tool: 'search', durationMs: 142 })`. Then dashboards filter on `event` not on regex over `msg`.
- **Sampling for noisy paths.** Health checks at 1% sampling; LLM token traces at 100%.
- **Log → trace correlation.** With OTel, the `traceId` field links logs to spans in your tracing UI. Make sure your collector is configured to recognize `traceId` (Tempo, Honeycomb, Datadog all do).

### Anti-patterns

- `console.log` anywhere in app code (lint-rule it).
- String interpolation: `logger.info(\`user \${id} did X\`)` — kills queryability. Always pass an object.
- Logging full request bodies. PII risk + storage cost. Log a hash if you need correlation.

★ Insight ─────────────────────────────────────
- Pino's `mixin` running inside ALS is the magic that lets handler code log without ever passing `requestId` around. The whole spine of cross-cutting concerns hangs off this one trick.
- Redaction is *path-based*, not regex-based — Pino walks the object tree and replaces. This is fast (no regex per line) but means `redact.paths` must be kept current as you add fields. Periodic audit (LLM-as-judge against a sample of recent logs is a legitimate eval) is wise.
─────────────────────────────────────────────────

---

## 7. Observability — OpenTelemetry as the unifier

OTel gives you the *one* protocol that carries traces, metrics, and logs out of the app. Backends are interchangeable — start with whatever ships with your cloud (CloudWatch / Azure Monitor / Cloud Trace), graduate to Tempo+Loki+Mimir or Honeycomb when you outgrow it.

### Wiring

```ts
// instrumentation.ts — required to load before app code
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OpenInferenceFastifyInstrumentation } from '@arizeai/openinference-instrumentation-fastify';

new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME,
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [
    ...getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },  // noisy
    }),
    new OpenInferenceFastifyInstrumentation(),  // LLM-aware
  ],
}).start();
```

`getNodeAutoInstrumentations` covers Fastify, `pg`, `ioredis`, AWS SDK v3, `undici`, etc. — almost every IO call becomes a span without app code change.

### Per-request waterfall you should see in Tempo/Honeycomb

```
GET /v1/reports/:id                          312ms
├── auth.verifyJwt                            4ms
├── tenant.resolve                            1ms
├── postgres SELECT reports                  18ms
├── postgres SELECT report_lines             22ms
├── llm.anthropic.messages.create           241ms   model=claude-sonnet-4-6
│   ├── prompt.cache.hit  bytes=18432
│   └── tokens.input=412 tokens.output=178
├── audit.emit                               6ms
└── pino.req.complete                        0ms
```

The LLM span is the one most homegrown setups miss. `@arizeai/openinference-*` is the path of least resistance — it instruments OpenAI, Anthropic, LangGraph, Vercel AI SDK, etc. — and Langfuse / Honeycomb / Tempo all render those spans natively.

### Metrics worth wiring up first

- **RED per route**: rate, errors, duration (p50/p95/p99) — already covered by auto-instrumentation.
- **Per-tenant**: requests/sec, error rate, p95 latency, $/min in LLM cost. This is where multi-tenancy becomes a *product* concern (noisy-neighbor detection, per-plan SLOs).
- **LLM**: tokens in/out per model, prompt-cache hit ratio, agent tool-call retries. Langfuse covers most of this; OTel covers the rest.
- **Saturation**: event-loop delay (`@fastify/under-pressure` exposes it), pool waits (`pg-pool` exposes pending count).

★ Insight ─────────────────────────────────────
- `@arizeai/openinference-*` is the bridge that makes LLM/agent calls show up as *real* OTel spans — not log lines. Once that's in place, Langfuse becomes one OTel backend among many; you can swap it for Honeycomb / Tempo / Phoenix without touching app code. The *spec compliance* matters more than the choice of UI.
- The traceparent header is the *single string* that connects everything: edge → Fastify → Postgres → LLM call → audit row → log line. Treat it as a load-bearing primitive — propagate it through every queue message, every job, every outbound HTTP call.
─────────────────────────────────────────────────

---

## 8. Performance — what to measure, what to tune

Order of magnitude (Node 22 + Fastify on a single 4-core container):

- Hello-world JSON: 60–80k req/s.
- With auth + Zod validation + Postgres lookup: 8–15k req/s.
- LLM-fronting endpoint: bound entirely by upstream latency; concurrency, not throughput, is the thing.

### Tunables ranked by impact

1. **Response schema → `fast-json-stringify`**. Declare schemas. ~2× JSON throughput.
2. **Connection pool sizing**. `postgres({ max: N })` where N ≈ `(target_concurrency / avg_query_time_in_seconds)`. Most teams over-pool — Postgres connections are not free.
3. **Avoid `await` in hot paths that don't need it**. Each `await` is a microtask hop; in a hook fired 60k times/sec it adds up. If something is sync (e.g. cached JWKS verification on a cached key), keep it sync.
4. **Compression** — Brotli is much slower than gzip on small payloads. For sub-1KB bodies, skip compression. Streaming responses (SSE for LLM) should *never* be compressed (latency >> bytes saved).
5. **Logging** — Pino + transport in worker thread (`pino.transport({ target: '...', target: 'pino/file' })`) keeps log I/O off the main thread.
6. **`undici` over `axios`** — `undici` is the fetch impl in Node 22; for outbound HTTP, use it directly instead of axios/got/superagent. Connection pooling is its differentiator.
7. **Backpressure** — `@fastify/under-pressure` returns 503 when event-loop delay exceeds a threshold. Better to shed load gracefully than to fail every in-flight request.

### Common foot-guns

- **Sync crypto in hot paths** — `crypto.scryptSync`, `bcrypt.compareSync` block the loop. Use the async variants or move to a worker.
- **Unbounded `Promise.all`** over user input — use `p-limit` with a sane concurrency cap.
- **Logging to stdout under load** — stdout is sync in containers. Use Pino's worker-thread transport or accept the perf hit.
- **JSON.parse on huge bodies** — set `bodyLimit` per route.
- **Memory leaks in ALS** — `extras` map kept alive past request end. Don't store anything large in `extras`; clear `request.ctx` in `onResponse` if you stash heavy refs.

### When to reach for Bun (and when not)

For a regulated production target right now: stay on Node 22 LTS. Bun is 1.5–2× faster on micro-benchmarks but the operational surface (debuggers, profilers, mature OTel SDKs, package compatibility for native deps like `@confluentinc/kafka-javascript`) is materially smaller. Use Bun for:

- Local dev (faster `vitest` runs).
- Test harness in CI (often 30–50% faster).
- One-shot scripts and codegen.

Re-evaluate Bun-as-prod yearly.

---

## 9. Putting it together — the hook chain in code

Skeleton of `app.ts` showing how the per-request concerns wire up. Each plugin is a separate file in real life.

```ts
import Fastify from 'fastify';
import { fastifyRequestContext } from '@fastify/request-context';

export async function buildApp() {
  const app = Fastify({
    logger,
    genReqId: (req) => (req.headers['x-request-id'] as string) ?? ulid(),
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    ajv: { customOptions: { coerceTypes: false, removeAdditional: 'failing' } },
    bodyLimit: 1_048_576,
  });

  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);

  await app.register(fastifyRequestContext);
  await app.register(helmetPlugin);
  await app.register(corsPlugin);
  await app.register(otelPlugin);            // span per request, traceparent prop
  await app.register(contextPlugin);         // ALS: requestId, traceId, tenantId
  await app.register(authPlugin);            // preValidation: verify JWT
  await app.register(tenantPlugin);          // preValidation: resolve tenant_id
  await app.register(rateLimitPlugin);       // preHandler: per-tenant buckets
  await app.register(idempotencyPlugin);     // preHandler + onSend
  await app.register(rlsPlugin);             // preHandler: SET LOCAL app.tenant_id
  await app.register(auditPlugin);           // onResponse + onError: write audit row
                                             // (Tier 1 default; see §5 for fan-out)
  await app.register(abortPlugin);           // onRequestAbort: cancel upstream LLM
  await app.register(errorHandlerPlugin);    // setErrorHandler: shape problem+json
                                             // onError:        OTel exception, audit
  await app.register(routes, { prefix: '/v1' });

  app.addHook('preClose', async () => {
    // Server now rejects new requests with 503; in-flight ones still draining.
    // Tier 1 audit (PG-only): nothing to drain — the row was committed
    // in the request transaction. This hook is a no-op.
    // Tier 2/3 (shipper or outbox dispatcher): drain here while the DB
    // pool is still open.
    await auditDrainIfRunning();
  });

  app.addHook('onClose', async () => {
    // HTTP server already stopped; release infrastructure.
    await closePools();
  });

  return app;
}
```

Two ordering subtleties that the upstream docs make explicit:

- **`setErrorHandler` vs `onError`** — `onError` *cannot* change the error and `reply.send()` inside it throws. Use `setErrorHandler` to *shape* the response (problem+json, status code mapping); use `onError` only for telemetry side-effects (OTel `recordException`, audit-of-errors emit).
- **`preClose` vs `onClose`** — `preClose` runs while in-flight requests are still draining (the server already returns 503 for *new* requests). That's the correct window for any work that still needs the DB pool open — e.g. draining a Tier-2 shipper or Tier-3 outbox dispatcher (§5). For a Tier-1 audit setup the hook is just a no-op. `onClose` runs *after* the HTTP server has stopped — use it only for releasing infrastructure (pools, Kafka producers). `onClose` is also the only hook that's *not* encapsulated, so it always runs at the root scope regardless of where it was registered.

Read top-to-bottom, this *is* the architecture: every cross-cutting concern is one named plugin, registered in the order it should fire. New developers find a single file and understand the request lifecycle in five minutes. That's the payoff.

---

## 10. The internal platform package — making this real

Everything above is the *spec*. This section is the *delivery vehicle*: how an enterprise actually ships these decisions to its teams as installable code.

### 10.1 Package layout (pnpm workspaces / Turborepo / Nx — pick one)

A single internal monorepo, published to a private registry (GitHub Packages, JFrog Artifactory, Verdaccio, npm Pro), versioned in lockstep:

```
@org/contracts      ── Zod schemas shared across services + edge
                       (request/response, audit events, queue messages).
                       Exposes EventEnvelope<T>, defineEvent({ name,
                       schemas, upcast }) helpers, and a registry of
                       upcasters for Parallel-Change discipline (§10.3).
@org/server         ── Fastify app factory: ALL hooks pre-wired
                       buildApp() returns a configured Fastify with auth,
                       tenancy, RLS, audit, OTel, Pino, error shape, etc.
                       Exposes only: route registration + Zod schemas.
@org/auth           ── JWT mint/verify, JWKS cache, capability tokens,
                       WorkOS/Clerk adapters, API-key hashing+lookup,
                       webhook HMAC helpers (Stripe/GitHub/etc).
@org/tenancy        ── ALS context spine, tenant-resolution strategies,
                       withTenant() DB wrapper, fast-check generators
                       for property-based tenancy isolation tests.
@org/db             ── postgres (porsager) + Drizzle setup, migration
                       runner, RLS policy generator, connection-pool
                       sizing helper, transaction wrappers.
@org/audit          ── audit_events table migration + event Zod schemas
                       (Tier 1, default). Optional sub-modules for
                       Tier 2 (cold-storage shipper) and Tier 3
                       (outbox + Kafka dispatcher). Services opt in.
@org/observability  ── Pino + OTel + OpenInference wiring as one import,
                       redaction path lists, mixin for ALS, problem+json
                       error formatter, RED/per-tenant metric helpers.
@org/messaging      ── @aws-sdk/client-sqs + sqs-consumer wrappers,
                       Kafka producer (only loaded by services that need
                       it), BullMQ helpers; tenant-context propagation.
                       Consumer wrapper auto-applies EventEnvelope parse
                       + registered upcaster + idempotency-by-message-id;
                       handlers only ever see the latest payload shape.
@org/llm            ── Anthropic / OpenAI / Gemini clients with prompt-
                       caching defaults, per-tenant cost meter,
                       AbortSignal plumbing for client-disconnect.
@org/testing        ── Testcontainers harness (PG, Redis, Kafka),
                       fast-check arbitraries, fixtures. Pact stubs
                       only at boundaries the compiler can't see —
                       third-party APIs, cross-language consumers.
                       (See §10.3 for the in-org alternative.)
@org/eslint-config  ── Lints: no console.log, no string-interp logging,
                       no raw fetch, no req.headers reads in handlers.
                       Event-schema rules: forbid .strict() and
                       .passthrough(false) on schemas under
                       @org/contracts/events/* (tolerant readers).
@org/tsconfig       ── strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes.
```

The shape of `@org/server` is the load-bearing decision. It's a *factory*, not a base class — teams call `buildApp({ serviceName, routes })` and get back a Fastify instance with every plugin from §9 already registered in the right order. They never see `app.register(authPlugin)`. That's the seam.

```ts
// In a service repo: src/main.ts
import { buildApp } from '@org/server';
import { routes } from './routes';

const app = await buildApp({
  serviceName: 'invoicing',
  serviceVersion: process.env.GIT_SHA!,
  routes,                          // your Zod-typed handlers
});
await app.listen({ port: 8080, host: '0.0.0.0' });
```

That's the entire `main.ts`. Auth, tenancy, audit, OTel, Pino, RLS, idempotency, rate-limiting, graceful shutdown, problem+json errors — all already wired.

#### Additive-only discipline as platform code

If §10.3's Parallel Change is taken seriously and §11.2's envelope-versioning ladder is the in-flight strategy, the platform should make the discipline the path of least resistance — not a convention people remember. Concretely:

- **`@org/contracts` defines events, not bare schemas.** A `defineEvent({ name, schemas: { v1, v2 }, upcast })` helper wraps payloads in `EventEnvelope` (`{ schemaVersion, payload }`), defaults payload schemas to `passthrough()`, and *requires* a registered `upcast(env): Latest` function for any event with more than one version. CI fails the platform-package PR if a v2 schema is added without an upcaster.
- **`@org/eslint-config` forbids `.strict()` and `.passthrough(false)` on anything imported from `@org/contracts/events/*`.** Rationale: those modes reject unknown fields — exactly what tolerant readers must accept during a transition. Rule applies in service repos, not just the contracts package.
- **`@org/messaging` calls `upcast(env)` automatically inside its consumer wrapper.** Service handlers only ever see the latest payload shape; they cannot accidentally branch on `schemaVersion` because they never see it. The seam keeps service code blind to versioning, which is what makes the discipline survive turnover.
- **`@org/audit`'s outbox/shipper variants emit `EventEnvelope` to Kafka/cold storage**, so the same upcasting story applies to audit consumers (SIEM, downstream analytics, replay tooling) as to in-process consumers.
- **`@org/testing` ships an `assertUpcasterCoverage(eventName)` helper.** Run as a unit test in every service that consumes the event, asserting that for *every* published `schemaVersion`, the upcaster produces a valid latest payload. Coverage is enforced at consumer granularity, not centrally — services that only handle a subset of events still get told when their subset has gaps.

The practical outcome: a platform-team developer adding a v3 of an event opens a PR in `@org/contracts`, declares the new schema *and* the v2-to-v3 upcaster in one `defineEvent` call. The lint, the consumer wrapper, the test helper, and the auto-fan-out to downstream services do the rest. They cannot accidentally introduce `.strict()`, skip the upcaster, or land a schema change that consuming services parse silently-wrong. The compiler catches structural drift; the platform catches process drift.

### 10.2 The template repo + scaffolder

Pair the package set with a `create-org-service` CLI (or `degit`-style template):

```
$ pnpm dlx @org/create-service my-new-api
  ✓ created my-new-api/
  ✓ src/main.ts          (uses @org/server)
  ✓ src/routes/          (one example handler with Zod schema)
  ✓ src/contracts/       (re-exports from @org/contracts)
  ✓ test/                (vitest + @org/testing harness)
  ✓ Dockerfile           (distroless, non-root, OTel sidecar)
  ✓ .github/workflows/   (build, test, SBOM, sign, deploy)
  ✓ helm/ or pulumi/     (matching @org/platform infra package)
  ✓ CODEOWNERS, ADR-0001, runbook stub
```

The point: a new service is *correct by default*. It logs to Pino with the right redaction, emits OTel traces with `tenant.id`, writes an audit row in the request transaction, has tenant-scoped rate limits. Teams deviate from the template only by deleting things, never by adding cross-cutting infrastructure.

### 10.3 Versioning, publishing, contract evolution

- **Single-version monorepo** (Lerna `--exact`, Nx-style, or Changesets in fixed mode). All `@org/*` packages bump together. This sounds aggressive; in practice it's the only way the upgrade lever stays sharp.
- **Renovate / Dependabot** in every service repo, configured to auto-PR `@org/*` updates, auto-merge minors after CI passes, file Jira tickets for majors.
- **CHANGELOG discipline** — every PR to the platform repo writes a Changeset entry. Major versions get an MIGRATION.md with codemod where possible (`jscodeshift` / `ast-grep`).
- **Private registry, signed packages** — npm provenance (`--provenance`), or Sigstore for non-npm registries. SBOMs on every release.

#### The compiler is the contract test

When all schemas live in `@org/contracts` as Zod, all consumers are TypeScript services in the org's monorepo, and every service runs strict-mode `tsc` in CI, **the type checker subsumes most of what consumer-driven contract testing (Pact) gives you — at zero ops cost.** A breaking change to a Zod schema produces a compile error in every consumer the moment Renovate opens the bump PR. The maintainer is alerted by failing CI, not by a broker dashboard.

The discipline that makes this work without a flag-day migration is **Parallel Change** (Danilo Sato's name; sometimes called expand/contract):

1. **Expand** — additive change only. Add the new field/shape alongside the old. Both ship in the same package version. Old consumers keep compiling.
2. **Migrate** — Renovate fans out the bump PR; consumers move to the new shape at their own CI's pace. The platform team tracks adoption via a simple registry (`@org/contracts` exposes a `meta` export listing the deprecated shapes; a CI script in each service reports which deprecated symbols it still imports).
3. **Contract** — once every consumer is on the new shape, the platform team removes the old. Bump, fan out again. Codemods (`jscodeshift` / `ast-grep`) bundled in the migration package handle the mechanical edits.

```ts
// Phase 1 — expand. Both shapes valid in the same package version.
export const Invoice = z.object({
  id: z.string().uuid(),
  amount: z.number(),                       // existing
  amountMinorUnits: z.bigint().optional(),  // new, additive
});
// JSDoc-mark the old field; the lint rule below picks it up.
/** @deprecated use amountMinorUnits — removal in v8.0.0 */
export const InvoiceAmount = Invoice.shape.amount;

// Phase 3 — contract. After every consumer is migrated.
export const Invoice = z.object({
  id: z.string().uuid(),
  amountMinorUnits: z.bigint(),             // now required, old shape gone
});
```

Where compile-time + parallel change earns its keep, and where it doesn't:

| Boundary | Compile-time + parallel change | Pact still earns its keep |
|---|---|---|
| Sync TS-to-TS HTTP within the org | yes — compiler catches drift | no |
| Sync TS service → third-party API | no (compiler can't see their shape) | yes (record real interactions) |
| Sync non-TS consumer → org's TS service | partial (no compile check across language) | yes |
| Async messaging (Kafka/SQS/Pub-Sub) within the org | partial — producer can deploy v2 while a consumer at v1 is still draining | only if message contracts are formalised; usually a runtime `Zod.parse` + dead-letter is enough |
| Persisted shape (DB / queue durables) | no — that's a migration concern, not a contract test | no — neither tool helps; this is migration discipline |

The runtime gap to be honest about: a contract change merges in code, but deployment lags. Until every service is redeployed with the new package, runtime mismatches are still possible — particularly for async messaging where producer and consumer deploy independently. Two mitigations:

- **Strict additive runtime discipline** — events on a wire are only ever extended with optional fields between major versions; consumers `Zod.parse` inbound payloads with `passthrough()` and tolerate unknown fields. Renames and removals require a *new event type* with a different topic/subject, not a schema mutation.
- **Deploy-order gates** — a service's deploy job refuses to start if its `@org/contracts` lockfile is older than `latest - N` published versions, forcing the queue to drain or other services to redeploy first. (CI rule, not a runtime check.)

The honest bottom line: **for an internal, all-TS, monorepo'd, single-version platform, this mechanism is enough — Pact's value drops sharply.** Pact moves from a default in `@org/testing` to a tool reserved for the specific cases above (third-party APIs, language boundaries). One fewer service to run (the broker), one fewer DSL, one fewer thing to maintain — and the failure mode is more obvious (CI red on a Renovate PR vs. a broker dashboard nobody reads).

### 10.4 Governance — who owns the paved road

- A small platform team (3–6 engineers) owns `@org/*` and the template. Not a tower; a team that takes contributions and runs the release train.
- **Inner-source contribution model** — service teams open PRs against the platform repo when they hit a missing primitive. Platform team reviews for consistency, generality, and security.
- **Quarterly platform review** — every service team's lead is invited; backlog gets re-prioritised against real friction points, not the platform team's tastes.
- **"Off-road" escape hatch** — services *can* bypass the platform (e.g. drop down to raw Fastify) but lose paved-road support: no shared on-call coverage, no automatic security patches, mandatory written exception with expiry. Make the escape hatch real, but make it cost something.

### 10.5 The platform package as LLM-assistant grammar

Once the platform package is the de-facto vocabulary, an LLM coding assistant (Claude Code, Cursor, Copilot, Codex) can be steered toward it cheaply:

- Bundle `@org/server`'s README + a representative service's source into the assistant's context (CLAUDE.md / `.cursor/rules/` / project knowledge).
- Add ESLint rules that fail PRs introducing forbidden patterns (`console.log`, raw `fetch`, `req.headers['x-tenant-id']`). The lint output is the assistant's feedback signal.
- Add a `pnpm exec @org/lint-architecture` check that asserts `main.ts` calls `buildApp` and nothing else cross-cutting.

This is how an enterprise gets *consistency at agent-generated scale*: the assistant produces code that looks like the platform package, because the platform package is what's in its context and what the lint rules enforce. Without this grammar, agent-written code drifts from the architecture within weeks.

### 10.6 Cost — be honest

A platform team is real headcount (3–6 engineers, 12–18 months to v1.0 that 5+ services adopt). The ROI shows up in three places:

- **Avoided outages** from per-service mistakes (missed RLS clause, mis-redacted logs, wrong cookie scope) — historically the dominant cost in regulated multi-tenant systems.
- **Compressed audit cycles** — SOC 2 / ISO 27001 / HIPAA controls are demonstrated *once* against the platform package, then inherited by every service.
- **Faster product velocity** post-platform — measured in time-to-first-endpoint and in mean-time-to-rollback, both of which collapse once `buildApp()` is doing the heavy lifting.

The anti-pattern to avoid: the "framework that nobody uses" — built in isolation by the platform team, shipped over the wall, ignored. Ship `@org/server` v0.1 with *one* real service migrated to it, before writing v0.2. Co-build it with the first two consumers, not for them.

★ Insight ─────────────────────────────────────
- The single hardest call in §10.3 is the single-version-monorepo decision. Independent SemVer feels safer to package authors but produces a matrix of versions across services that becomes unmaintainable within a year. Lockstep versioning forces the platform team to keep changes additive and well-codemoded — which is exactly what you want.
- §10.4's "inner source" framing is what distinguishes a platform that *grows* from a platform that *ossifies*. The teams using `@org/server` daily know its sharp edges before the platform team does. Make their PRs first-class, not interruptions.
─────────────────────────────────────────────────

---

## 11. Async workflows, in-flight messages, and when sagas earn their keep

§10.3 was honest about a runtime gap: a contract change merges in code, but deployments lag — and for async messaging, producer and consumer deploy at different times. The compile-time + Renovate mechanism handles *future* messages once everything redeploys; it does nothing for messages already on the wire or for workflow state already persisted under the old code. This section walks through the cheapest mechanism per problem class and names the case where reaching for a saga orchestrator (Temporal, Camunda, AWS Step Functions, Inngest) genuinely earns its keep — and the more common case where it doesn't.

### 11.1 Three classes of "already on the wire"

The runtime-gap problem is really three different problems with different time horizons and different cheapest solutions:

| Class | Time horizon | Cheapest solution |
|---|---|---|
| **In-transit messages** (queue/topic) | seconds → minutes | Tolerant readers; envelope versioning if removals/renames |
| **Persisted workflow state** (a saga that's mid-flight) | hours → weeks | Workflow versioning (engine support) or upcasting on resume |
| **Audit / event store** (records you query later) | years | Event sourcing + projection versioning, never mutate stored events |

Conflating these is where over-engineering enters. A team hits problem class 1 (Kafka v1 messages straggling after a v2 deploy), reaches for Temporal "for the workflow problem", and now owns a workflow engine they didn't need.

### 11.2 The ladder for in-transit messages — pick the cheapest tier that works

**Tier A — Additive-only + tolerant readers (default; free)**

- Producers only extend events with optional fields; never remove or rename in place.
- Consumers `Zod.parse` with `passthrough()` and read only the fields they care about. Unknown fields tolerated.
- Removing a field = retire the event type entirely; introduce a new event type on a new subject/topic.
- Handles a surprising fraction of real-world changes. The remainder need Tier B.

**Tier B — Envelope versioning + in-process upcasters (cheap; local; no extra infra)**

Every event carries `{ schemaVersion, payload }`. `@org/contracts` exposes a small upcaster:

```ts
// in @org/contracts
export const InvoiceCreatedV1 = z.object({ id: z.string(), amount: z.number() });
export const InvoiceCreatedV2 = z.object({ id: z.string(), amountMinorUnits: z.bigint() });
export type InvoiceCreated = z.infer<typeof InvoiceCreatedV2>;

export function upcastInvoiceCreated(env: { schemaVersion: 'v1' | 'v2'; payload: unknown }): InvoiceCreated {
  if (env.schemaVersion === 'v2') return InvoiceCreatedV2.parse(env.payload);
  const v1 = InvoiceCreatedV1.parse(env.payload);
  return { id: v1.id, amountMinorUnits: BigInt(Math.round(v1.amount * 100)) };
}
```

Consumers always operate on the canonical (latest) shape. Once monitoring confirms no `v1` envelopes have been seen for the retention window of the queue, the v1 schema and upcaster are removed in a follow-up release. Cost: one envelope field, one function per breaking change. Reasoning: the upcaster *is* the migration — it's typed, tested, and lives in the same package as the schema.

**Three versions in flight — chained vs. direct upcasters.** The interesting case isn't v1→v2; it's what happens when v3 lands while v1 messages are still draining (long retention windows, cold queues, persisted workflow state from §11.3). Two valid implementations, with different review-cost trade-offs:

```ts
// A year later: amount-bearing semantics return, now with currency.
export const InvoiceCreatedV3 = z.object({
  id: z.string(),
  amountMinorUnits: z.bigint(),
  currency: z.string().length(3),  // ISO 4217
});
export type InvoiceCreated = z.infer<typeof InvoiceCreatedV3>;

// ─── Approach A — chained: each version upcasts only from the previous ───
//   v1 → v2 → v3. Review burden per release stays local.
//   Cold-path cost grows with version count; v1 traverses every step.
function v1ToV2(v1: InvoiceCreatedV1): InvoiceCreatedV2 {
  return { id: v1.id, amountMinorUnits: BigInt(Math.round(v1.amount * 100)) };
}
function v2ToV3(v2: InvoiceCreatedV2): InvoiceCreatedV3 {
  return { ...v2, currency: 'USD' };  // legacy default; see caveat below
}
export function upcastInvoiceCreated(env): InvoiceCreated {
  switch (env.schemaVersion) {
    case 'v3': return InvoiceCreatedV3.parse(env.payload);
    case 'v2': return v2ToV3(InvoiceCreatedV2.parse(env.payload));
    case 'v1': return v2ToV3(v1ToV2(InvoiceCreatedV1.parse(env.payload)));
  }
}

// ─── Approach B — direct: each old version has its own function to latest ───
//   Cold paths are O(1) regardless of version count.
//   When latest evolves, every direct upcaster needs review for transitive correctness.
const v1ToLatest = (v1: InvoiceCreatedV1): InvoiceCreated => ({
  id: v1.id,
  amountMinorUnits: BigInt(Math.round(v1.amount * 100)),
  currency: 'USD',
});
const v2ToLatest = (v2: InvoiceCreatedV2): InvoiceCreated => ({ ...v2, currency: 'USD' });
export function upcastInvoiceCreated(env): InvoiceCreated {
  switch (env.schemaVersion) {
    case 'v3': return InvoiceCreatedV3.parse(env.payload);
    case 'v2': return v2ToLatest(InvoiceCreatedV2.parse(env.payload));
    case 'v1': return v1ToLatest(InvoiceCreatedV1.parse(env.payload));
  }
}
```

Recommendation:

- **Default to chained.** Most schema changes are mechanical and the per-step function is small. Reviewers see the new step in isolation; old steps are stable.
- **Switch to direct when an upcast carries semantic assumptions** — currency defaulting, tenant-context recovery, derivation that depends on knowing the *original* version. Putting each old version's full migration in one function makes the assumptions visible to reviewers and easier to revisit when business rules change.
- **Whatever you pick, make it consistent per event type.** Mixing within one upcaster is a smell.

Two non-negotiables in either approach:

- **Coverage assertion in CI** — for every published `schemaVersion`, a test asserts the upcaster produces a valid latest payload. The §10.1 `assertUpcasterCoverage(eventName)` helper does this; without it, you only learn about a missing branch when production hits a cold v1 message at 3 AM.
- **Telemetry-gated removal** — the v1 schema and its upcast path are only removed in a release where production has reported zero v1 envelopes for at least the queue/state retention window. The producer side can speed this up by re-publishing residual v1 messages as latest after the upcaster is live (free — idempotency keys from §4.4 make this safe), draining v1 deliberately rather than waiting for natural decay.

**Tier C — Schema registry (Avro/Protobuf) — real infrastructure**

Confluent Schema Registry / Apicurio / AWS Glue Schema Registry. Each message carries a schema id; consumers fetch by id; the registry enforces forward/backward compatibility at publish time.

Earned when **at least one** is true:
- Cross-language consumers (Python, JVM, Go) where TS-only upcasters don't help.
- External partners subscribing to your events.
- Enough breaking changes per quarter that codegen pipelines pay back.

For an all-TS internal org, usually overkill.

**Tier D — Versioned topics (heavy; last resort)**

`events.invoices.v1` and `events.invoices.v2` are separate streams. Producers cut over; v1 drains; consumers retire. Earned only when the *meaning* (not just the shape) of the event has changed and upcasting is semantically impossible. Cost: dual-publish window, dual-consumer code, extra ops surface.

The right default in this stack is **A → B as needed**, with C reserved for genuine cross-language pressure and D for genuinely fundamental redesigns. Most teams get years out of A+B alone.

### 11.3 Multi-step workflows — state is the harder problem

A workflow that spans steps over hours, days, or weeks holds *persisted state*: in a DB row, a workflow-engine history, a saga table. When code redeploys, that state was written by the old code and is now being read by the new code. This is genuinely harder than in-transit messages because the state can be arbitrarily old.

Two architectural choices that determine how painful this is:

**Choice 1 — Persist events, not snapshots (event sourcing).**

Append-only events are immutable, so they're easy to evolve: only the *projection* (the code that reads events to compute current state) gets versioned. Old events stay valid forever; if you change the projection, you replay. This is exactly the same shape as the audit / deterministic-replay table from §6 of the parent doc — the same primitive serves both.

The cost: event-sourcing discipline (no mutating writes; every state change is an event; projections are pure functions of event history) is real and not free. For workflows specifically, it's worth it; for general CRUD, it's usually not.

**Choice 2 — Persist snapshots with explicit version + upcasters.**

Each row carries a `state_version`. On read, if version < current, run the registered upcaster to migrate in-memory; optionally write back the upgraded shape. Same pattern as Tier B for messages, applied to durable state. Works, but every breaking change needs a new upcaster *and* a back-fill plan for cold rows.

**Choice 3 — Workflow-engine versioning (Temporal, Camunda, Step Functions).**

If you're running a real workflow engine, it gives you primitives for this directly: Temporal's `workflow.getVersion()` lets new code paths be introduced while in-flight workflows continue on the old path. Step Functions lets you version state machines and pin executions to a version. This is the cleanest path *if you already need a workflow engine for other reasons* — it's not a reason to introduce one.

The honest framing: workflow-state evolution is a tax you pay regardless of the storage choice. Event sourcing reduces it; engines automate it; snapshot+upcaster handles it manually. The wrong move is pretending the tax doesn't exist and being surprised when a customer's three-week-old workflow blows up under v2 code.

### 11.4 When sagas/orchestrators earn their keep — and when they don't

The word "saga" is overloaded. Three meanings worth separating:

1. **Garcia-Molina/Salem 1987** — long-lived transactions with compensating actions: each step has a defined "undo", and failure of step N triggers compensations for steps 1..N-1.
2. **Multi-step orchestration** — Microservices.io's broader sense; an orchestrator (or a chain of choreography handlers) drives a workflow across services.
3. **Workflow engine** — Temporal / Camunda / Step Functions / Inngest as a generic primitive for "long-running, durable, retry-safe code."

A team needs *meaning 1* (compensation-aware sagas) when **all** of these are true:

- A business operation spans multiple services *and* multiple steps must succeed atomically.
- Each step has a meaningful, business-defined compensation (refund, cancel reservation, release inventory).
- Failure mid-way *requires* undoing prior steps — leaving them committed is wrong.
- The time horizon makes 2PC / synchronous distributed transactions infeasible.

If any one of those is false, you don't need saga semantics. You need:

- An **idempotent multi-step pipeline** (event → handler → event → handler …) with retries and dead-letters. Most "workflows" are this. The right tools are: a queue, idempotency keys (already in §4.4), structured retries with exponential backoff, dead-letter handling. No saga framework required.
- A **state machine** (state stored in a row; transitions guarded; observable). Tools: a `pg_state_machines` extension, a small in-app FSM library (XState if rich), or just `CASE WHEN current_state = ...`. No saga framework required.
- A **scheduled / delayed job** ("retry this in 4 hours", "run on the 1st of every month"). Tools: BullMQ, AWS EventBridge Scheduler, Temporal cron — pick by ops appetite.

A team needs *meaning 3* (a workflow engine) when **at least one** is true:

- They have many long-running multi-step operations and homegrown retry/scheduling/visibility code is becoming a service in itself.
- They need durable execution semantics — code that resumes after a process crash, with the language acting as the workflow definition.
- They need cross-language workflow steps (Temporal supports this well).
- They need explicit, queryable workflow state for support and debugging.

When none of those bite, a workflow engine is a heavy abstraction added before its time. The local cost (run a Temporal cluster, learn the SDK, design for non-determinism) is real; the gain is hypothetical until the simpler patterns demonstrably break down.

#### A note on framing — durable execution as a runtime property

Recent thinking (Temporal, Restate, DBOS, Inngest, Cloudflare Durable Objects + Workflows) increasingly treats **durable execution as a property of the runtime**, not a separate framework people learn. The semantic shift: ordinary code that contains `await` calls becomes durable when run on a durable-execution runtime — process crashes resume mid-function, retries are automatic, side effects are replay-safe by construction. Instead of "we built a workflow with an orchestrator", it becomes "this function happens to live on the durable side of the boundary."

What changes if you accept that framing:

- The mental model is closer to *async/await with strong guarantees* than to *write a state machine*. Less DSL, more language.
- Small durable functions become viable. Historically a side effect needed to be either "trivial enough to retry on SQS" or "important enough to model as a saga" — nothing in between. Durable execution lets you write a 30-line function that survives crashes without ceremony.
- The runtime imposes a *determinism constraint* on the durable code (no `Date.now()`, no `Math.random()`, no direct I/O — everything goes through engine-provided primitives so replay is reproducible). That's a real cost. The benefit is that the constraint is *local* to the durable function, not a whole-system architectural choice.
- Operationally it's still the same investment as adopting a workflow engine: you operate the runtime (or pay a vendor), accept the SDK lock-in, and train people on the determinism model. The framing just makes the *granularity* finer — it lowers the threshold at which the investment is worth making.

When to reach for it deliberately:

- Option 3 (saga table) starts feeling thin: state-machine code is sprawling, retries are getting bespoke, support engineers struggle to answer "what is this workflow doing right now?".
- A class of small "do this reliably even if I crash mid-way" needs is appearing — sequenced LLM tool-call chains, multi-step provisioning, billing reconciliations — and the boilerplate per workflow is dwarfing the business logic.
- Cross-language workflow steps are real (Temporal supports this well; Restate/DBOS less so).

When *not* to:

- You have one or two long-running flows. A saga table is cheaper.
- You have an engineering culture that pushes against learning new mental models. Durable execution rewards investment; without it, the runtime becomes the source of "weird bugs" that nobody owns.
- You want to keep options open between vendors. SDK lock-in is real; portability between durable runtimes is currently weak.

The honest takeaway: don't promote a workflow engine to "default infrastructure" because the framing got more attractive. Promote it when option 3 visibly fails for *your* workflows — and when it does, evaluate the durable-execution-as-runtime products specifically against the workflow-engine-as-product mental model, because the granularity-and-DX argument is the differentiator.

The progression that tends to work, ordered by escalating cost:

1. Synchronous request → response (boring; correct for most things).
2. Async with a queue + idempotent consumer + dead-letter + idempotency keys.
3. Async with a queue + a saga *table* (a row tracking state per workflow instance, advanced by handlers). Custom but understandable.
4. A dedicated workflow engine (Temporal et al.) — when 3 has obviously outgrown its limits.
5. Event sourcing — when *replay* and *audit* matter as much as workflow execution.

Skip-ahead failure mode: jumping from 2 to 4 because "we have workflows now" is the most common over-engineering trap in this space. The cost surfaces as: a Temporal cluster on the SRE rotation, every developer learning a new mental model, and most of the code paths still being indistinguishable from option 2 dressed up in an SDK.

### 11.5 What this means for `@org/messaging` and `@org/contracts`

If the org adopts the ladder, the platform package needs three small primitives — and that's all most services need:

- **`@org/contracts` exposes envelopes by default.** Every event type ships as `{ schemaVersion, payload }` from day one, with a registered `upcast<EventName>(env)` function that resolves to the latest shape. Service code never branches on version.
- **`@org/messaging` enforces idempotency at the consumer.** Wrap the SQS/Kafka/BullMQ consumer to look up `(consumer, message.id)` in Redis before invoking the handler; record `(message.id, handler_result)` after. Replays become free; saga-table state machines become safe to retry.
- **`@org/workflow` (optional sub-package) for the small fraction of services that need it.** A typed state-machine helper (XState wrapper, or a tiny `defineSaga({ steps, compensations })` API) backed by a `workflow_instances` table. Not a workflow engine — a deliberate small primitive for option 3 above. Services that need real durable execution graduate to Temporal/Inngest as a separate adopt-with-eyes-open decision.

The point of this layout is to make the *cheap* mechanisms first-class so teams reach for them before they reach for an engine. The engine remains an option; it just stops being the reflexive answer.

★ Insight ─────────────────────────────────────
- Idempotency keys (§4.4) are doing double duty here: they're how the in-flight problem becomes survivable. If consumers are idempotent, replaying a v1 message after the upcaster is deployed is correct by construction — you can drain queues by re-publishing without fear of double effects.
- The bridge between §11 and §10 is `@org/contracts`. Putting the envelope shape and upcasters *inside the schema package* (not in service code) is what makes Tier B cheap to adopt. Bury upcasters in service repos and you re-create the drift problem you just solved with the compiler.
- Event sourcing keeps coming up not because it's universally right, but because it solves §5's audit, §6's deterministic LLM replay, §10.3's contract evolution, *and* §11.3's workflow state in one mechanism. That's a strong hint to consider it for the workflow-heavy parts of the platform — not a license to make everything event-sourced.
─────────────────────────────────────────────────

---

## 12. Items to verify with current docs before committing

- `@fastify/type-provider-zod` Zod 4 compatibility (Zod 4 reshaped error formatting).
- `@fastify/request-context` interaction with streaming responses (SSE keeps ALS alive past `onResponse` if not handled).
- `@arizeai/openinference-instrumentation-fastify` coverage of streaming LLM responses.
- WorkOS SCIM event delivery semantics (at-least-once → audit pipeline must be idempotent).
- OpenFGA vs Cerbos for the chosen tenancy model (relationship-rich → OpenFGA; policy-rich → Cerbos).
- Pino transport behaviour under k8s log rotation; whether to keep stdout-direct or worker-thread transport.
- `onRequestAbort` reliability under your reverse-proxy / load-balancer combination (the Fastify docs flag client-disconnect detection as best-effort) — exercise with k6 / vegeta runs that kill connections mid-flight and confirm upstream LLM `AbortController` actually fires.
- Web Streams `Response` and `ReadableStream` payload support in `onSend` — current Fastify accepts both, but third-party hooks (compression, response-time, etc.) sometimes don't; verify any plugin you wire into the streaming path.
- `fastify-plugin` wrapping for any plugin that needs to publish decorators to the parent scope (auth context, OTel tracer, DB client) — without it, decorators stay encapsulated and the rest of the app can't see them. Conversely: tenancy/auth *enforcement* plugins should **not** be wrapped, so each `register()` block gets its own auth scope.

---

## Cross-cutting summary

The tightest test of whether this layer is right: **a junior engineer adding a new endpoint should never have to touch auth, tenant, audit, logging, tracing, or rate-limit code.** All they should write is the Zod schema, the handler body, and the route registration. If that's true, the per-request platform is doing its job. If it isn't, the architecture has leaked and the next regulated audit will find every leak.

That test is also the acceptance criterion for the internal `@org/server` platform package described in §10. The whole doc, read end-to-end, is one answer to a single enterprise question: *what does the package an enterprise's platform team should ship to its product teams contain, and why?* The architectural decisions in §1–§9 are the contents; §10 is the delivery mechanism. Get both right and the next service starts at the handler signature, with audit, tenancy, and observability already correct — and the org's upgrade lever is one `renovate.json` away from being pulled.
