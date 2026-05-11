# Future Stack Options

A landscape survey across the layers needed for a multi-tenant, regulated, high-throughput agent platform — with a synthesized recommendation at the end. Scope: Node / Bun / Deno runtimes. Time horizon: stack choices for a Python/FastAPI → Node/TS evolution.

---

## 1. Postgres clients & ORMs

### Low-level drivers
| Package | Runtimes | Notes |
|---|---|---|
| `pg` (node-postgres) | Node, Bun | Mature, callbacks/Promises, optional `pg-native` libpq binding. |
| **`postgres`** (porsager) | Node, Bun, Deno | Tagged-template API (`` sql`...${val}` `` auto-parameterizes), faster than `pg`, supports LISTEN/NOTIFY, COPY, pipelining. **Default for new code.** |
| `bun:sql` (`Bun.sql`) | Bun only | Built-in. API mirrors porsager/postgres. Fastest on Bun. |
| `deno-postgres` (`jsr:@db/postgres`) | Deno | First-party Deno driver. |
| `@neondatabase/serverless` | Node, Bun, Deno, Workers, Edge | `pg`-compatible API over WebSocket/HTTP. Required for serverless/edge. |
| `@vercel/postgres` | Node, Edge | Thin wrapper over Neon's serverless driver. |

### Query builders
- **Kysely** — type-safe SQL builder; pluggable dialects (`pg`, `postgres`, Neon, PGlite, D1).
- Knex — pre-TS-era; weaker types; legacy.

### ORMs
- **Drizzle ORM** — schema-as-TS, SQL-shaped, migrations, runs on every runtime. Current default for new TS projects.
- **Prisma** — schema DSL, generated client, great DX; 2025 driver-adapters mode removes the Rust engine.
- TypeORM — decorator-based, mature, weak TS inference; legacy.
- MikroORM — unit-of-work / data-mapper.
- Sequelize — old guard; mostly legacy.

### Embedded / specialty
- **PGlite** (`@electric-sql/pglite`) — Postgres compiled to WASM. Tests, local-first, demos.
- `pg-mem` — in-memory PG-like; not 100% PG-compatible.
- Slonik — `pg` wrapper with strict types + Zod runtime validation.

### Picks
- New Node/Bun, plain SQL → `postgres` (porsager), or `Bun.sql` on Bun.
- New TS, want types around SQL → Kysely + `postgres`.
- New TS, want an ORM → Drizzle (SQL-shaped) or Prisma (DSL-shaped).
- Edge/serverless → `@neondatabase/serverless`.
- Tests / local-first → PGlite.

### Insights
- **Runtime matters more than expected.** TCP drivers (`pg`, `postgres`) won't run on Workers/Vercel Edge — needs HTTP/WebSocket like `@neondatabase/serverless`. Drizzle/Kysely abstract over this.
- **`postgres` (porsager) vs `pg`** — tagged templates make SQL injection structurally hard.
- **Bun's native `sql`** ships with Bun 1.2+; API-compatible with porsager. Skip the dependency on Bun.
- **Drizzle vs Prisma in 2026** — Prisma's old engine binary complaint is gone with driver adapters; Drizzle is still typically faster, smaller, more SQL-honest. Prisma wins on migrations/Studio.

---

## 2. Vector databases (Pinecone / Weaviate / Qdrant)

### Pinecone
- Package: `@pinecone-database/pinecone`
- Runtimes: Node, Bun, Deno (`npm:`), Workers, Vercel Edge (pure HTTPS).
- Optional gRPC subclass (`PineconeGrpc`) — Node-only.
- Managed SaaS only. Schemaless: vectors + JSON metadata. Smallest API.

### Weaviate
- Current: `weaviate-client` v3 (TS-native, gRPC-first). Legacy: `weaviate-ts-client` v2.
- Runtimes: Node, Bun, Deno via `npm:`. **Edge: limited** — v3 uses gRPC, doesn't run on Workers; v2 REST works but is feature-behind.
- Self-host or Weaviate Cloud. Real schema, vectorizer modules, generative modules, hybrid (BM25 + vector), multi-tenancy.
- TS-first generics: `client.collections.get<MyShape>("Articles")`.

### Qdrant
- Packages: `@qdrant/js-client-rest` (universal) and `@qdrant/js-client-grpc` (Node only).
- Runtimes: REST works Node/Bun/Deno/Workers/Edge (pure fetch). gRPC = Node only.
- Self-host (single Rust binary) or Qdrant Cloud.
- Strongest at multi-vector points (dense + sparse + late-interaction per point) and hybrid via prefetch + fusion (RRF/DBSF).

### Picks
- Edge / Workers / Vercel Edge → Pinecone or Qdrant REST.
- Self-host, full control, fastest → Qdrant.
- DB handles embedding/generation → Weaviate.
- Zero-ops managed → Pinecone.
- Hybrid (dense + sparse + rerank) → Qdrant or Weaviate.
- Bun/Deno → All REST clients work via `npm:` specifier.

### Insights
- **Edge support is the silent decider.** Only Pinecone and Qdrant REST work on Workers/Vercel Edge OOTB.
- **Schema philosophy differs.** Pinecone schemaless, Qdrant schemaless-with-payload-indexes, Weaviate has a real schema with modules.
- **Hybrid search differs.** Qdrant most flexible (named vectors + RRF/DBSF), Weaviate easiest defaults, Pinecone tunable via `alpha`.
- **gRPC vs REST** — gRPC is 5–10× ingest throughput but Node-only. Common pattern: ingest via Node gRPC, query via REST from edge.
- `pgvector` is the dark-horse alternative — if you already run Postgres, it often beats adopting a separate vector DB until scale demands.

---

## 3. Messaging (Kafka / Pulsar / SQS)

### Kafka
| Package | Runtimes | Notes |
|---|---|---|
| `kafkajs` | Node, Bun | Pure JS, raw TCP. Mature; maintenance has slowed. No edge. |
| **`@confluentinc/kafka-javascript`** | Node | Native librdkafka binding. KafkaJS-compatible API. KIP-848 next-gen consumer groups. Heavy install, no Bun/Deno. |
| `node-rdkafka` | Node | Original librdkafka binding. Largely superseded. |
| `@upstash/kafka` | Node, Bun, Deno, Workers, Edge | HTTP/REST. Upstash-only. |
| Confluent REST Proxy / Karapace | Anywhere with fetch | Generic edge route via REST. |

### Pulsar
| Package | Runtimes | Notes |
|---|---|---|
| `pulsar-client` (apache-pulsar/pulsar-client-node) | Node | Official C++ binding. Heavy install. |
| Pure-JS WebSocket clients | Node, Bun, browser | Pulsar's WebSocket protocol is first-class. Subset of features (no transactions, schemas client-side). |
| Pulsar HTTP Admin API | Anywhere with fetch | Admin only, not data plane. |

### SQS
| Package | Runtimes | Notes |
|---|---|---|
| **`@aws-sdk/client-sqs`** (v3) | Node, Bun, Deno, Workers, Edge | HTTPS + SigV4. Modular, tree-shakeable. |
| `sqs-consumer` | Node, Bun | Long-poll loop, visibility-timeout heartbeats, partial-batch failure handling, graceful shutdown. The de facto consumer wrapper. |
| Lambda event-source mapping | (no client needed) | Lambda invokes you with batches. |
| `aws4fetch` | Anywhere with fetch | 6KB SigV4 signer; hand-craft the API call. |

### Picks
- Long-running Node, throughput matters → `@confluentinc/kafka-javascript`, official `pulsar-client`.
- Long-running Node, install simplicity matters → `kafkajs`, Pulsar WebSocket.
- Lambda / containerized worker on SQS → `@aws-sdk/client-sqs` + `sqs-consumer`.
- Workers / Vercel Edge / Deno Deploy → SQS via AWS SDK v3 or `aws4fetch`. Kafka via `@upstash/kafka` or self-hosted REST proxy. Pulsar via WebSocket.
- Bun → pure-JS options work; native bindings case-by-case.
- Deno → `npm:` specifiers; native modules unreliable.

### Insights
- **Wire protocol determines runtime options.** Kafka/Pulsar = stateful TCP (great for long-running, terrible for serverless/edge). SQS = HTTPS request/response (only one of the three that runs natively on Workers/Lambda/Edge).
- **`kafkajs` vs `@confluentinc/kafka-javascript`** — KafkaJS pure JS, ships anywhere Node runs. Confluent's client is faster, supports KIP-848 (fixes long-standing rebalance pain), but is native-only. Common path: KafkaJS until throughput/rebalance issues, then migrate (API compatible).
- **Pulsar's WebSocket protocol is underused.** Lets you talk to Pulsar from Bun, Deno, browsers without native deps.
- **`sqs-consumer` does more than it looks** — heartbeats `ChangeMessageVisibility`, partial-batch failure semantics, backpressure. Rolling your own usually produces a subtly broken version.
- **Edge messaging story is bifurcating.** Native Kafka/Pulsar from Workers means "use a hosted HTTP front-end" — trades features and latency for portability. If edge = latency, putting Kafka behind HTTPS often defeats the point. Consider Cloudflare Queues / Upstash QStash / SQS instead.

### Adjacent
- Cloudflare Queues, Upstash QStash, Inngest, Trigger.dev, Temporal — often a better fit than forcing Kafka/SQS into edge/serverless.
- Schema registries: `@kafkajs/confluent-schema-registry` (Kafka), Pulsar built-in.
- OpenTelemetry: KafkaJS, AWS SDK v3, Pulsar C++ client all have OTel instrumentation. Pure-JS Pulsar WS clients usually don't.

---

## 4. Cloud SDKs (AWS / Azure / GCP)

### AWS
- **AWS SDK for JavaScript v3** (`@aws-sdk/client-<service>`). Modular, pure HTTPS, `fetch`-based, edge-native.
- v2 (`aws-sdk`) — legacy ~100MB monolith. Don't start here.
- Companion: `@aws-sdk/lib-<service>` (e.g. `lib-dynamodb` `DocumentClient`, `lib-storage` multipart `Upload`).
- Auth: `@aws-sdk/credential-providers`.
- Presigning: `@aws-sdk/s3-request-presigner`.
- Lightweight: `aws4fetch` (6KB SigV4 signer).
- Lambda: `@aws-lambda-powertools/{logger,tracer,metrics,parameters,idempotency}` — genuinely upgrades any Lambda codebase.
- Infra: `aws-cdk-lib` (different category — IaC).

### Azure
- Modular `@azure/<service>` family. Auth unified via **`@azure/identity`** (`DefaultAzureCredential` chains env → managed identity → CLI → VS Code).
- HTTPS / edge-friendly: `@azure/storage-blob`, `@azure/cosmos`, `@azure/keyvault-*`, `@azure/event-grid`, `@azure/ai-inference`, `@azure/search-documents`.
- AMQP-based / edge-hostile: `@azure/service-bus`, `@azure/event-hubs`.
- AI: `@azure/openai` is being **deprecated** — use the `openai` package with `AzureOpenAI` class.
- ARM management plane: `@azure/arm-<service>`.

### GCP — two parallel client families
**Family 1: `@google-cloud/<service>`** (idiomatic, hand-written, mostly Node-only via gRPC)
- `@google-cloud/storage` (mostly REST, works in Bun)
- `@google-cloud/firestore`, `@google-cloud/pubsub`, `@google-cloud/spanner`, `@google-cloud/secret-manager` (gRPC, Node-only)
- `@google-cloud/bigquery` (REST-ish, Bun OK)

**Family 2: AI/Gemini**
- **`@google/genai`** — unified Gemini SDK (replaces `@google/generative-ai` and subsumes `@google-cloud/vertexai`). Pure HTTPS, runs everywhere.

**Family 3: Firebase**
- `firebase` (client SDK; modular; edge-friendly)
- `firebase-admin` (server SDK; gRPC for Firestore; Node-focused)

**Auth**
- `google-auth-library` (lower-level — ADC, service-account JWTs, ID tokens, impersonation)
- `google-gax` (gRPC abstraction; rarely touched directly)

**For edge / Bun / strict Deno on GCP**: use the REST endpoint directly via `fetch` + token from `google-auth-library`, OR use `@google/genai` and Firebase modular client (both pure HTTPS), OR Workload Identity Federation + small fetch wrapper.

### Picks
- Edge / Workers / Vercel Edge → AWS SDK v3 (full coverage); Azure HTTPS clients; GCP via REST + auth library or `@google/genai`.
- Bun → AWS SDK v3 works; Azure HTTPS clients fine, AMQP flaky; GCP packages mostly work, verify per-package.
- Deno → `npm:` specifiers; native modules unreliable; AWS smoothest.
- Multi-cloud auth abstraction → mirror Azure's `DefaultAzureCredential` pattern.

### Insights
- **Three SDKs, three worlds.** AWS v3 rebuilt around `fetch` and Smithy → runs anywhere. Azure HTTPS-first, AMQP bolted on for streaming. GCP gRPC-first internally, hand-written wrappers above. If you're picking a cloud for an edge-first stack, this is a real consideration.
- **AWS v2 → v3 is one-way.** v2 in maintenance mode, no new features. Migration mostly mechanical (`new S3Client()` + `Command` objects).
- **`@azure/openai` is being deprecated.** Use `import { AzureOpenAI } from "openai"`.
- **Azure's `DefaultAzureCredential` is the best auth pattern across the three clouds.** Mirror it elsewhere.
- **GCP gRPC has an upside**: streaming is first-class (Firestore listeners, Pub/Sub streaming pull, Spanner streaming reads). Architectural answer is often "Node worker close to GCP doing streaming, fronted by an HTTPS API the edge can call."
- **OIDC federation in CI/CD** is the right default — AWS via `aws-actions/configure-aws-credentials`, Azure via `azure/login`, GCP via `google-github-actions/auth`.

---

## 5. AI / ML packages (agentic, OCR, document, vision)

### LLM provider SDKs
- `@anthropic-ai/sdk` (Claude) — streaming, tools, prompt caching, extended thinking, batches, files, computer use, agent skills.
- `openai` — OpenAI + Azure OpenAI + OpenAI-compatible servers (Groq, Together, OpenRouter, vLLM, Ollama). The lingua franca.
- `@google/genai` — Gemini API + Vertex AI Gemini. Replaces `@google/generative-ai` and `@google-cloud/vertexai`.
- `@mistralai/mistralai` — including their strong OCR endpoint.
- `cohere-ai` — `rerank-v3.5` is best-in-class for hybrid retrieval.
- `groq-sdk`, `together-ai`, `replicate`, `fireworks-ai`, `@openrouter/ai-sdk-provider`.
- `ollama` — local inference daemon client.

### Agent / orchestration frameworks
- **`@anthropic-ai/claude-agent-sdk`** — same machinery as Claude Code. File system, bash, sub-agents, MCP, hooks, permission modes.
- **`ai`** (Vercel AI SDK) — `streamText`, `generateText`, `tool()`, `streamUI`, structured outputs via Zod. Provider-pluggable. Edge-native. The de facto baseline.
- **`mastra`** — full agent framework: agents, workflows, memory, RAG, evals, MCP. Built on Vercel AI SDK.
- **`@langchain/langgraph`** — explicit state-machine agents, checkpointing, human-in-the-loop. The modern bit of LangChain.js.
- `llamaindex` — strongest at RAG (ingest pipelines, retrievers, query engines).
- `@inngest/agent-kit` — durable execution, retries, observability.
- **`@modelcontextprotocol/sdk`** — MCP client + server SDK. Becoming the de facto agent-tool interop protocol.

### OCR
- **Pure-LLM** (Claude vision, GPT-4o, Gemini) — usually right answer for new code.
- `tesseract.js` — Tesseract WASM. 100+ languages. Free, runs anywhere, slower.
- AWS Textract (`@aws-sdk/client-textract`) — OCR + forms + tables + signatures.
- Azure Document Intelligence — pre-built models (invoices, receipts, IDs) + custom + layout.
- GCP Document AI (`@google-cloud/documentai`) — pre-built processors + custom training. gRPC.
- **Mistral OCR** (via `@mistralai/mistralai`) — outputs Markdown with preserved structure. Genuinely strong.

### Document understanding (PDF/DOCX/PPTX → structured)
- **LlamaParse** (`@llamaindex/cloud`) — best-in-class for messy PDFs with tables.
- `unstructured-client` — PDF/DOCX/PPTX/HTML/email → typed elements.
- `@mendable/firecrawl-js` — web → markdown / structured.
- `pdf-parse`, `pdfjs-dist` — local PDF text extraction.
- `mammoth` — DOCX → HTML/Markdown.
- `xlsx` (SheetJS), `exceljs` — spreadsheets.
- `officeparser` — DOCX/PPTX/XLSX/PDF in one package.
- **Pure-LLM** with PDF input + Zod via `generateObject` — often the simplest pipeline for ≤100-page docs.

### Computer vision
**Image preprocessing**
- **`sharp`** (libvips) — fastest. Standard for any image preprocessing in Node.
- `@napi-rs/canvas`, `canvas` — server-side Canvas API.
- `jimp` — pure-JS, slower, runs anywhere.

**ML inference**
- **`@huggingface/transformers`** v3 — ONNX Runtime + WebGPU. Object detection, segmentation (SAM, SAM2), depth, image-to-text (Florence-2), zero-shot detection, embeddings. Runs in Node/Bun/Deno/browser/Workers.
- `onnxruntime-node` / `onnxruntime-web`.
- `@tensorflow/tfjs-node`, `@tensorflow/tfjs` + `@tensorflow-models/*`.
- `@mediapipe/tasks-vision` — hand/pose/face landmarks, real-time.
- `face-api.js` — aging but works.
- Cloud CV APIs: `@aws-sdk/client-rekognition`, `@azure/ai-vision-image-analysis`, `@google-cloud/vision`.
- **Pure-LLM vision** for non-real-time use cases.

**Image generation**
- `replicate` — easiest path to Flux/SDXL/Ideogram/Recraft/Imagen.
- `@fal-ai/serverless-client` — fast inference, optimized cold starts.
- `openai` (gpt-image-1, DALL-E 3); `@google/genai` (Imagen, Gemini image gen).

### Speech / audio / video
- `openai` (Whisper, TTS, gpt-4o-audio + Realtime API).
- `@deepgram/sdk` — best-in-class streaming ASR.
- `assemblyai` — transcription + diarization + LeMUR.
- `@cartesia/cartesia-js` — Sonic voice models, very low-latency TTS.
- `@elevenlabs/elevenlabs-js` — TTS + voice cloning + STT.
- `@huggingface/transformers` — Whisper, Moonshine, Distil-Whisper, Kokoro TTS locally.
- `fluent-ffmpeg` + ffmpeg.
- `@livekit/agents-js`, `@livekit/server-sdk-js` — real-time multimodal pipelines (Node).

### Embeddings / RAG plumbing
- Provider SDKs (OpenAI `text-embedding-3-*`, Cohere `embed-v4`, Voyage, Mistral, Gemini).
- **`voyageai`** — Anthropic-recommended; best general-purpose embeddings + rerank as of late 2025.
- `@huggingface/transformers` — local embeddings (BGE, E5, Nomic, jina-embeddings-v3).
- `@langchain/textsplitters` — recursive/character/markdown/code splitters.
- Tokenizers: `tiktoken`, `gpt-tokenizer`, `@anthropic-ai/tokenizer`.

### Local inference
- **`ollama`** — best DX for local LLMs.
- `@huggingface/transformers` — pure-JS/WASM/WebGPU.
- `node-llama-cpp` — llama.cpp bindings, GGUF + GPU offload.
- `@mlc-ai/web-llm` — WebGPU LLM in browsers.

### Eval / observability / safety
- `langfuse` — OSS-friendly LLM observability. Self-host or hosted.
- `helicone` — drop-in proxy via `baseURL`.
- `braintrust` — eval platform.
- `@arizeai/openinference-*` — OpenTelemetry instrumentation for OpenAI/Anthropic/LangChain.
- `promptfoo` — eval runner; CI-friendly.

### Insights
- **The landscape collapsed into three layers.** (1) Provider SDKs (pure HTTPS, edge-native). (2) Orchestration (Vercel AI SDK or Mastra). (3) Specialty packages (Transformers.js, LlamaParse, Deepgram). For most apps, layers 1+2 are enough.
- **LLMs ate most of the OCR/CV pipeline.** A vision LLM with a Zod schema replaces Tesseract → bounding-box → manual fix-up. Reach for Textract/Document AI/Tesseract only when you need ms latency, sub-cent costs, on-device privacy, or very high volume.
- **Transformers.js v3 is the dark horse.** Serious models (SAM2, Florence-2, Whisper, Kokoro, BGE) run in Node/Bun/Deno/browsers/Workers with WebGPU. Catch: cold-start model loading and Workers 128MB limit.
- **MCP is the agent-tool standard.** Build tools as MCP servers — works with Claude Desktop, Claude Code, Cursor, Continue, Cline.
- **Vercel AI SDK vs Mastra vs LangGraph trilemma.** Vercel AI = lowest-level + edge-friendly. Mastra = highest-level (config + memory + RAG + evals). LangGraph = explicit state machines / branching / human-in-loop / checkpointing. Pick by topology, not hype.
- **Voice agents are infrastructure-heavy.** LiveKit Agents is the practical Node answer.
- **Edge-runtime is a silent filter.** Provider SDKs work on Workers; Transformers.js / Tesseract / ffmpeg / sharp / native ONNX are Node-only or have Worker limits. Pattern: edge for orchestration / streaming / auth, Node workers for heavy ML, talking via queues or HTTP.

---

## 6. Synthesized enterprise stack (target architecture)

Aimed at: multi-tenant, regulated, high-throughput agent workloads with LLM + vision in the loop, evolving from Python/FastAPI toward Node/TS.

### Guiding principles
1. **Edge-portable by default**, native where it earns its keep.
2. **Single auth model per cloud** — one `getCredential()` with chained providers (mirror Azure's `DefaultAzureCredential`).
3. **Tenancy is a property of the data plane, not a wrapper** — every record, queue message, vector, log, span, LLM call carries `tenant_id`.
4. **Determinism is first-class** — every LLM/agent call logged with input, model id, params, tool calls, output, cost, confidence. Replay = `SELECT`.
5. **Fewer, sharper tools** — one primary + one fallback per layer, not three "to evaluate."

### Recommended stack

**Runtime & language**
- Node 22 LTS, TypeScript 5.x strict.
- `tsx` for dev, `tsup` / `esbuild` for build.
- Bun OK for local dev / scripts / tests; not production for regulated org yet.
- Deno: out for now.

**Web / API**
- **Fastify** with `@fastify/type-provider-zod` or TypeBox provider.
- **Zod** as universal schema lib.
- **Hono** for any edge-deployed surface (Workers/Vercel Edge).
- tRPC for tightly-coupled internal admin UIs only.

**Data — Postgres-first**
- **Postgres** (Aurora PG / Azure Flexible / Cloud SQL — match dominant cloud).
- **`postgres`** (porsager) driver.
- **Drizzle ORM** for schema + migrations + types.
- **`pgvector`** up to ~10M vectors per tenant; **Qdrant Cloud** as escalation path.
- **RLS + query-builder middleware** for tenant predicates (belt and braces). `SET LOCAL app.tenant_id` per request.
- `@neondatabase/serverless` for edge functions needing low-latency reads.

**Caching / online state**
- **Redis** (Elasticache / Azure Cache / Memorystore) with **`ioredis`**.
- Used for: rate limits per tenant, idempotency keys, tool-call dedupe, BullMQ job state.
- **`bullmq`** for in-process job queues.

**Messaging — choose by deployment cloud**
- Primary: cloud-native — **SQS + EventBridge** (AWS) / **Service Bus + Event Grid** (Azure) / **Pub/Sub** (GCP). Per-tenant queue or namespaced topic.
- High-throughput agent fan-out: **Kafka** via **`@confluentinc/kafka-javascript`** on Confluent Cloud — for ordered, replayable agent traces / event sourcing.
- Edge-side enqueue: Cloudflare Queues or Upstash QStash.
- Avoid: Pulsar (weak JS story).

**Search**
- **OpenSearch / Elasticsearch** via `@opensearch-project/opensearch` for tenant-scoped lexical + audit log queries.
- **Hybrid retrieval** = pgvector (dense) + Postgres FTS or OpenSearch (BM25) + **Cohere `rerank-v3.5`** as final pass.

**LLM / agent layer**
- Provider: `@anthropic-ai/sdk` (primary), `openai` (secondary, also Azure OpenAI), `@google/genai` (long-context / vision-heavy).
- Orchestration: **Vercel AI SDK** (`ai` + provider adapters) as default.
- Long-running / branching: **`@langchain/langgraph`**. Mastra as higher-level option.
- Internal coding/automation agents: **`@anthropic-ai/claude-agent-sdk`**.
- Tool interop: **`@modelcontextprotocol/sdk`** — every reusable tool is an MCP server.
- Embeddings: **Voyage `voyage-3-large`** (BGE-M3 via Transformers.js for cost-sensitive paths).
- Prompt caching: Anthropic `cache_control` everywhere system prompt or tenant context > a few KB.

**Document understanding / OCR / vision**
- First choice for new pipelines: **Vision LLM + Zod via `generateObject`**.
- Heavy structured docs at volume: **Mistral OCR** or **LlamaParse**, then LLM for extraction.
- Forms / receipts / IDs at enterprise volume: cloud-native (Textract / Document Intelligence / Document AI) matching deployment.
- CV preprocessing: **`sharp`**.
- Local CV / on-device embeddings: **`@huggingface/transformers`** v3.

**Observability, evals, replay**
- **OpenTelemetry** via `@opentelemetry/sdk-node` + **`@arizeai/openinference-*`** instrumentation for LLM calls.
- **`langfuse`** (self-hosted in-VPC for regulated data) — LLM-specific tracing, prompt management, costs per tenant.
- **`braintrust`** or **`promptfoo`** for offline evals in CI.
- **Deterministic replay table** — `agent_calls(tenant_id, request_id, model_id, params, input_hash, output, tool_calls jsonb, cost, confidence, redactions)`.
- **Confidence scoring** via dedicated classifier or LLM-as-judge with fixed rubric. Low-confidence → human-review queue.

**Auth / identity / secrets**
- `@azure/identity` / `@aws-sdk/credential-providers` / `google-auth-library` behind a single `cloudCredential()` factory.
- **OIDC federation in CI/CD** — no static cloud creds in GitHub Actions.
- Secrets: cloud-native (Secrets Manager / Key Vault / Secret Manager).
- End-user auth: **WorkOS** or **Clerk** for B2B SSO/SAML/SCIM.

**Multi-tenant isolation**
- Pool model with hard fences: shared infra, per-tenant schema or RLS in PG, per-tenant prefix in Redis/OpenSearch/object storage, per-tenant rate limits, per-tenant LLM API key where customer requires own billing/keys.
- **Per-tenant encryption keys via KMS** — every blob, secret, embedding payload encrypted under a tenant CMK. BYOK is year-2 but design for it day one.
- Audit trail: append-only `audit_events` topic in Kafka → OpenSearch + cold storage in S3/Blob/GCS with object-lock retention.
- Data residency: tenant attribute pins which region tenant data lives in; mesh / app code enforces.

**Infrastructure & delivery**
- **Kubernetes** (EKS / AKS / GKE).
- **IaC: Pulumi (TypeScript)** if you want infra in the same language; Terraform / OpenTofu otherwise. Avoid CDK if multi-cloud.
- Service mesh: Istio or Linkerd — needed once mTLS-by-default and per-tenant policy become real.
- **CI/CD: GitHub Actions with OIDC** → Argo CD for GitOps. Trunk-based, short-lived branches, feature flags via `@openfeature/server-sdk` + Flagsmith / LaunchDarkly / GrowthBook.
- Container builds: Docker buildx + distroless. SBOM via Syft, scan via Grype/Trivy in CI.

**Testing**
- **`vitest`** as runner, vitest workspace for monorepos.
- `@fast-check/vitest` for property-based tests on tenant-isolation invariants.
- Testcontainers (`@testcontainers/postgresql`, etc.) for real PG/Redis/Kafka in integration tests. PGlite for fast inner-loop tier.
- Playwright for E2E.
- **`promptfoo`** evals as CI gates on prompt/agent changes.
- Pact or OpenAPI contract verification between services.

### Migration arc from Python/FastAPI
1. **Strangler at the edge** — Fastify (Node) in front of FastAPI as gateway / streaming surface.
2. **LLM/agent surface area first** — biggest Node/TS ecosystem advantage; biggest Python event-loop pain.
3. **Data-plane services next** — ingestion, parsing, embedding workers in Node; Drizzle replaces SQLAlchemy progressively.
4. **Keep Python where it earns weight** — ML training, notebook research, numpy/pandas/torch. Boundary: training & analytics in Python; serving & orchestration in Node.
5. **Shared schemas via OpenAPI** — Python and Node co-generate clients during overlap, enforced in CI.

### Anti-picks (explicit)
- AWS SDK v2 — done. `@aws-sdk/*` v3 only.
- Sequelize / TypeORM / Knex — Drizzle or Kysely.
- NestJS — too much ceremony; Fastify + conventions covers it.
- Pulsar — weak JS story.
- LangChain.js (chains/agents non-LangGraph parts) — use LangGraph specifically, or Mastra / Vercel AI SDK.
- `@azure/openai` — use `openai` with `AzureOpenAI`.
- Self-built voice agents from scratch — LiveKit Agents or OpenAI Realtime.
- Multi-cloud abstraction layers — pick one cloud as home, abstract only auth.

### Why this shape fits the role
- **High-throughput multi-tenant agent fan-out** → Fastify + Kafka (or SQS) + per-tenant queue partitioning + BullMQ for retries; LLM calls behind tenant-scoped rate limiter and circuit breaker.
- **Pipeline / DB / queue / model bottleneck diagnosis** → OpenTelemetry + OpenInference traces correlate HTTP → Kafka → Postgres → LLM in one waterfall; Langfuse for cost/latency per prompt.
- **Regulated hardening** → RLS + KMS-per-tenant + append-only audit + deterministic replay + region-pinning + WorkOS SAML/SCIM. All achievable without bespoke work.
- **Service ownership end-to-end** → Pulumi/Terraform per service, Argo CD per env, SLO-as-code (`sloth` / `pyrra`), runbooks linked from alerts.
- **TDD / trunk-based / pair-friendly** → Vitest fast enough to TDD comfortably; Drizzle + PGlite gives sub-second integration tests; `promptfoo` lets you TDD prompts.

### Items to verify with current docs before committing
- LangGraph.js checkpoint persistence + multi-tenant patterns.
- Vercel AI SDK `streamText` + `tools` + `experimental_telemetry` integration with OpenTelemetry.
- Qdrant hybrid + fusion (RRF/DBSF) query shape.
- KIP-848 consumer group support in `@confluentinc/kafka-javascript` for at-scale rebalance behavior.
- Drizzle's RLS support and tenant-scoped query helpers.

---

## Cross-cutting insight: why this stack composes

The non-obvious unifier across all five surveys is **"HTTPS-first, gRPC/native-where-it-earns-it"**. Postgres via `postgres` (porsager), vector via Qdrant REST, messaging via SQS, cloud via AWS SDK v3, AI via every provider's HTTPS SDK — assembled this way the stack runs on Node, Bun, Deno, and edge runtimes interchangeably. That portability isn't a vanity metric: it lets you place the right workload on the right runtime (orchestration at the edge, heavy ingest in Node, ML in Python or local Transformers.js) without rewriting clients.

For a regulated multi-tenant platform, the highest-leverage architectural decision isn't "Kafka or SQS" or "Drizzle or Prisma" — it's the **deterministic-replay table**. Once every LLM/agent call is row-addressable with input, params, output, and tool calls, postmortems become trivial, evals become regression tests, customer audits become SQL queries, and "why did the agent do that?" stops being a research project. None of the surveyed packages give this for free; build it once on top of Postgres + Kafka, and it pays for itself within months.
