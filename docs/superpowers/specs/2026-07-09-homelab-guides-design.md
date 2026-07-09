# Homelab guides — design

Date: 2026-07-09

## Goal

Mine real patterns from deployed projects (this docs site, `homelab-infra`,
`slackex`) and turn them into two new docs-site guides: a Caddy-docker-proxy
reverse-proxy cheatsheet (Homelab domain) and a production-delivery-principles
guide (Cloud Native domain).

## Source material

- `~/dev/elixir/slackex` — production Phoenix/LiveView app, self-hosted homelab
  deploy. Read: `docs/runbooks/deployment.md`, `docs/engineering-principles.md`,
  `docs/2026-03-10-caddy-docker-proxy-migration-design.md`,
  `infra/caddy/{Dockerfile,docker-compose.yml,Caddyfile}`,
  `docker-compose.prod.yml`, `scripts/caddy-cutover`.
- `~/dev/homelab-infra` — infra-as-code repo (Vaultwarden service, disaster
  recovery runbook, secret-sync scripts). Read for context; not directly
  sourced into either guide this round (Vaultwarden/secrets is a separate,
  deferred guide — see Deferred below).
- This repo's own `CLAUDE.md` homelab section (Proxmox/Docker host/Caddy/DNS
  topology) — corroborating source for the Tailscale-DNS-breaks-on-reboot
  pattern, independently hit in three repos.

## Decisions

- **Two guides this round**, not the full menu of five-six candidates
  surfaced during research. Caddy-docker-proxy and production-delivery-
  principles were explicitly selected; Tailscale/secrets/Proxmox-HA guides
  are deferred (see below).
- **Genericize hostnames and org names.** Every existing cheatsheet on this
  site (curl, TypeScript, ffmpeg) uses `example.com`-style placeholders, never
  real infrastructure. The Caddy guide follows the same convention — real
  config shapes, label syntax, and gotchas stay accurate; hostnames
  (`chat.davewil.dev` → `app.example.com`), the GHCR image path
  (`ghcr.io/d-j-will/slackex` → `ghcr.io/you/yourapp`), and host aliases
  (`tono`) are replaced with generic equivalents.
- **Format split matches the site's existing `ext` convention**: Caddy guide
  is `ext: "conf"` (dense, command/label-reference cheatsheet, same shell as
  curl/ffmpeg); principles guide is `ext: "md"` (narrative, lighter on code,
  matching DDD/Event-Driven Architecture's existing style).

## Files touched

| File | Change |
|---|---|
| `cheatsheets/caddy-docker-proxy-cheatsheet.html` *(new)* | 15-section Caddy-docker-proxy reverse-proxy guide |
| `cheatsheets/production-delivery-principles.html` *(new)* | ~7-section production delivery principles guide |
| `apps/docs-hub/data.js` | New `caddy-docker-proxy` topic under `homelab` (5th topic, existing 4 stubs untouched); new topic under `cloud-native` (4th topic there) |
| `cheatsheets/cheatsheets-index.html` | New preview cards + further-reading sections for both guides, following the ffmpeg-addition pattern |
| `cheatsheets/index.html` | Landing page copy updated if needed |

## Caddy cheatsheet — 15 sections

1. Why caddy-docker-proxy — the "multiple repos fighting over one Caddyfile" problem
2. Architecture — label-reading container, docker-socket mount, `proxy` network
3. Custom image — `xcaddy` build adding `caddy-docker-proxy` + `caddy-dns/cloudflare` plugins
4. Standalone Caddy compose service — `CADDY_INGRESS_NETWORKS`, `CADDY_DOCKER_CADDYFILE_PATH`, bind-mounted fallback Caddyfile
5. Fallback Caddyfile — for routes with no backing container
6. Basic single-app labels (one hostname, one upstream)
7. Multi-hostname labels on one container — the real `caddy_0`/`caddy_1` numbered-label pattern for exposing two hostnames off the same service
8. Multi-upstream + health checks — two app replicas, same hostname, automatic load-balancing/failover
9. The `force_ssl` 301 trap — why `health_headers X-Forwarded-Proto https` is mandatory
10. `docker restart` vs `caddy reload` — the stale-upstream-IP gotcha
11. Never use `import` in the Caddyfile — the bind-mount trap that crash-loops Caddy
12. Never dump Caddyfile to CI logs — it holds the DNS-challenge token
13. What disappears from app CI once you're on this — no more Caddyfile SCP/append/restart step
14. Zero-downtime cutover procedure — test-port verification (8080/8443), route checks, confirmation-gated production switch (from the real `caddy-cutover` script)
15. Troubleshooting checklist — reading `caddy-proxy` logs, confirming labels were picked up, curl route verification

## Production delivery principles — ~7 sections

1. Shift-left — local hooks must catch everything CI catches
2. Pre-deploy verification checklist
3. Expand/contract migration pattern (do's/don'ts table)
4. Feature-flag lifecycle (develop → deploy → validate → release → contract)
5. Test isolation — the ETS cross-contamination root-cause story as a worked example
6. Root cause, not workarounds — anti-pattern list
7. Summary checklist card

## Taxonomy additions (`data.js`)

Homelab domain gains a 5th topic (existing Tailscale/Cloudflare/Proxmox/Private
Cloud Stack stubs untouched):

```js
{ id: "caddy-docker-proxy", domain: "homelab", title: "Caddy Docker Proxy", ext: "conf",
  description: "Label-driven reverse proxy — no shared Caddyfile, no per-repo config fights. Zero-downtime multi-app cutover.",
  status: "reference", updated: "2026-07",
  href: "cheatsheets/caddy-docker-proxy-cheatsheet.html",
  subLinks: [{ label: "Caddy-docker-proxy cheatsheet (15 sections)", href: "cheatsheets/caddy-docker-proxy-cheatsheet.html" }],
  external: [ /* caddy-docker-proxy repo, Caddy docs — verified during citation pass */ ],
  tags: ["reverse-proxy", "docker", "tls"] }
```

Cloud Native domain gains a 4th topic:

```js
{ id: "delivery-principles", domain: "cloud-native", title: "Production Delivery Principles", ext: "md",
  description: "Shift-left CI, expand/contract migrations, feature-flag lifecycle, test isolation — lessons from running a real production system.",
  status: "reference", updated: "2026-07",
  href: "cheatsheets/production-delivery-principles.html",
  subLinks: [{ label: "Production delivery principles guide", href: "cheatsheets/production-delivery-principles.html" }],
  external: [ /* verified during citation pass */ ],
  tags: ["ci-cd", "migrations", "feature-flags"] }
```

## Verification plan

- HTML validated with Python's `html.parser` (unclosed-tag check), matching
  every prior page on this site.
- External citation URLs checked with the repo's mandatory `curl -sIL`
  workflow before commit.
- Browser smoke test: all three themes, mobile drawer, skip-link — same as
  the ffmpeg-cheatsheet verification pass.
- Docs-hub renders both new topics correctly (domains are confirmed
  data-driven from the ffmpeg work — no additional rendering-layer check
  needed).
- No commands to "run" here (this is infra documentation, not a CLI tool
  reference) — accuracy comes from directly reading the real, current
  source files (compose/Dockerfile/Caddyfile/script), not from memory.

## Deferred (not this round)

- **Tailscale operational patterns guide** (DNS-resolver-breaks-on-reboot fix,
  subnet routing, tailnet-gated CI) — would fill the existing Tailscale stub.
- **Secrets management / Vaultwarden guide** — would fill the existing Private
  Cloud Stack stub, sourced from `homelab-infra`.
- **Proxmox resilience & HA guide** — would fill the existing Proxmox VE stub.

Each is real, sourced material already identified during this session's
research; deferred purely on scope, not because the source material is
lacking. Revisit as follow-up rounds using the same pattern as this spec.
