// Topic + domain data for the programming site.
// Edit these directly to add / rename topics — the rest of the page reads from here.

window.DOMAINS = [
  {
    id: "languages",
    num: "01",
    title: "Languages",
    glyph: "λ",
    blurb: "Type systems, concurrency models, and runtimes — the substrates everything else sits on.",
    path: "languages"
  },
  {
    id: "web",
    num: "02",
    title: "Web & Runtime",
    glyph: "{}",
    blurb: "The HTTP-and-browser stack, JS event-loop semantics, the network protocols underneath.",
    path: "web-runtime"
  },
  {
    id: "applied-ai",
    num: "03",
    title: "Applied AI",
    glyph: "*",
    blurb: "Building with agents — skills, tool wiring, hooks, evals, and shipping it through CI.",
    path: "applied-ai"
  },
  {
    id: "cloud-native",
    num: "04",
    title: "Cloud Native",
    glyph: "◇",
    blurb: "Event-driven architecture, domain-driven design, pipelines — the shape of distributed systems.",
    path: "cloud-native"
  },
  {
    id: "homelab",
    num: "05",
    title: "Homelab",
    glyph: "▣",
    blurb: "Self-hosted infrastructure — overlay networks, edge routing, hypervisors, private cloud.",
    path: "homelab"
  }
];

window.TOPICS = [
  // ─── Languages ────────────────────────────────────────────────
  {
    id: "typescript",
    domain: "languages",
    title: "TypeScript",
    ext: "ts",
    description: "Strict types, inference, structural typing. Cheatsheet covers TS 6.0 primitives → utility types → tsconfig baseline.",
    status: "reference",
    updated: "2025-11",
    href: "cheatsheets/typescript-cheatsheet.html",
    subLinks: [
      { label: "TS 6.0 cheatsheet (23 sections)", href: "cheatsheets/typescript-cheatsheet.html" }
    ],
    external: [
      { label: "Handbook", href: "https://www.typescriptlang.org/docs/handbook/intro.html" },
      { label: "tsconfig", href: "https://www.typescriptlang.org/tsconfig" },
      { label: "Utility types", href: "https://www.typescriptlang.org/docs/handbook/utility-types.html" }
    ],
    tags: ["types", "tooling", "v6"]
  },
  {
    id: "csharp",
    domain: "languages",
    title: "C#",
    ext: "cs",
    description: "Records, pattern matching, source generators, AOT. Notes on idiomatic modern C# 13 / .NET 9.",
    status: "wip",
    updated: "2026-03",
    subLinks: [
      { label: "Modern C# notes — coming soon" },
      { label: "ASP.NET minimal APIs reference — coming soon" }
    ],
    external: [
      { label: "What's new in C# 13", href: "https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-13" },
      { label: ".NET docs", href: "https://learn.microsoft.com/en-us/dotnet/" },
      { label: "Book: C# in Depth", href: "https://csharpindepth.com/" }
    ],
    tags: ["dotnet", "managed"]
  },
  {
    id: "python",
    domain: "languages",
    title: "Python",
    ext: "py",
    description: "Modern Python 3.13: type hints, structural pattern matching, async, the packaging story with uv & ruff.",
    status: "reference",
    updated: "2026-01",
    subLinks: [
      { label: "Typing & dataclasses cheatsheet — coming soon" },
      { label: "uv + ruff workflow notes — coming soon" }
    ],
    external: [
      { label: "Python docs", href: "https://docs.python.org/3/" },
      { label: "PEP index", href: "https://peps.python.org/" },
      { label: "uv", href: "https://docs.astral.sh/uv/" },
      { label: "ruff", href: "https://docs.astral.sh/ruff/" }
    ],
    tags: ["scripting", "data", "async"]
  },
  {
    id: "elixir",
    domain: "languages",
    title: "Elixir",
    ext: "ex",
    description: "BEAM, actor model, fault tolerance. OTP, GenServers, supervision trees, LiveView for the web.",
    status: "deep-diving",
    updated: "2026-04",
    subLinks: [
      { label: "OTP supervision patterns — in progress" },
      { label: "Phoenix LiveView playbook — in progress" }
    ],
    external: [
      { label: "Elixir docs", href: "https://hexdocs.pm/elixir/" },
      { label: "Phoenix", href: "https://hexdocs.pm/phoenix/" },
      { label: "Book: Programming Elixir", href: "https://pragprog.com/titles/elixir16/programming-elixir-1-6/" },
      { label: "Book: Designing Elixir Systems w/ OTP", href: "https://pragprog.com/titles/jgotp/designing-elixir-systems-with-otp/" }
    ],
    tags: ["beam", "actor", "fp"]
  },

  // ─── Web & Runtime ──────────────────────────────────────────
  {
    id: "event-loop",
    domain: "web",
    title: "JS Event Loop",
    ext: "md",
    description: "Three-part progression — call stack & queues, the Promise interleave, then mapping all of it onto await.",
    status: "reference",
    updated: "2025-11",
    href: "cheatsheets/event-loop-index.html",
    subLinks: [
      { label: "Part 1 — build the model", href: "cheatsheets/js-q-explainer.html" },
      { label: "Part 2 — break wrong intuitions", href: "cheatsheets/js-q-2-explainer.html" },
      { label: "Part 3 — async / await migration", href: "cheatsheets/await-explainer.html" }
    ],
    external: [
      { label: "HTML spec — event loops", href: "https://html.spec.whatwg.org/multipage/webappapis.html#event-loops" },
      { label: "Jake Archibald — tasks/microtasks", href: "https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/" }
    ],
    tags: ["runtime", "async", "deep-dive"]
  },
  {
    id: "curl",
    domain: "web",
    title: "curl",
    ext: "sh",
    description: "16-section pocket reference: methods, auth, mTLS, retries, timing, parallel, plus non-HTTP protocols.",
    status: "reference",
    updated: "2025-11",
    href: "cheatsheets/curl-cheatsheet.html",
    subLinks: [
      { label: "curl cheatsheet (16 sections)", href: "cheatsheets/curl-cheatsheet.html" }
    ],
    external: [
      { label: "curl manpage", href: "https://curl.se/docs/manpage.html" },
      { label: "Everything curl (book)", href: "https://everything.curl.dev/" },
      { label: "httpbin.org", href: "https://httpbin.org" }
    ],
    tags: ["http", "tls", "cli"]
  },

  // ─── Applied AI ─────────────────────────────────────────────
  {
    id: "claude-skills",
    domain: "applied-ai",
    title: "Skills",
    ext: "md",
    description: "Composable, on-demand capabilities for agents — when to write one, scope boundaries, prompt patterns.",
    status: "deep-diving",
    updated: "2026-05",
    subLinks: [
      { label: "Skill authoring patterns — in progress" },
      { label: "Skill discovery & invocation map — in progress" }
    ],
    external: [
      { label: "Claude skills overview", href: "https://docs.claude.com/en/docs/build-with-claude/skills" },
      { label: "Anthropic cookbook", href: "https://github.com/anthropics/anthropic-cookbook" }
    ],
    tags: ["agents", "claude", "patterns"]
  },
  {
    id: "agents",
    domain: "applied-ai",
    title: "Agents",
    ext: "md",
    description: "Tool-use loops, planning, memory, multi-agent coordination. The harness around the model.",
    status: "deep-diving",
    updated: "2026-05",
    subLinks: [
      { label: "Tool-use loop reference — in progress" },
      { label: "Multi-agent patterns — in progress" }
    ],
    external: [
      { label: "Building effective agents (Anthropic)", href: "https://www.anthropic.com/research/building-effective-agents" },
      { label: "Claude tool use docs", href: "https://docs.claude.com/en/docs/build-with-claude/tool-use" }
    ],
    tags: ["agents", "tool-use", "planning"]
  },
  {
    id: "hooks",
    domain: "applied-ai",
    title: "Hooks",
    ext: "sh",
    description: "Pre/post-tool hooks, lifecycle interception, guardrails. Where to instrument an agent without rewriting it.",
    status: "wip",
    updated: "2026-04",
    subLinks: [
      { label: "Hook taxonomy & ordering — coming soon" },
      { label: "Safety guardrail recipes — coming soon" }
    ],
    external: [
      { label: "Claude Code hooks", href: "https://docs.claude.com/en/docs/claude-code/hooks" }
    ],
    tags: ["guardrails", "ci"]
  },
  {
    id: "ai-cicd",
    domain: "applied-ai",
    title: "CI / CD for Agents",
    ext: "yaml",
    description: "Eval pipelines, prompt versioning, regression suites, deployment gates. Treating agents like software.",
    status: "wip",
    updated: "2026-04",
    subLinks: [
      { label: "Eval pipeline blueprint — coming soon" },
      { label: "Prompt versioning playbook — coming soon" }
    ],
    external: [
      { label: "Anthropic evals cookbook", href: "https://github.com/anthropics/anthropic-cookbook/tree/main/skills/evals" },
      { label: "promptfoo", href: "https://www.promptfoo.dev/" }
    ],
    tags: ["evals", "pipelines", "ops"]
  },

  // ─── Cloud Native ───────────────────────────────────────────
  {
    id: "event-driven",
    domain: "cloud-native",
    title: "Event-Driven Architecture",
    ext: "md",
    description: "Choreography vs orchestration, outbox pattern, idempotency, event versioning, stream processing.",
    status: "wip",
    updated: "2026-02",
    subLinks: [
      { label: "Outbox + saga patterns — in progress" },
      { label: "Event versioning rules — in progress" }
    ],
    external: [
      { label: "EventStorming", href: "https://www.eventstorming.com/" },
      { label: "Microservices.io patterns", href: "https://microservices.io/patterns/" },
      { label: "Book: Building Event-Driven Microservices", href: "https://www.oreilly.com/library/view/building-event-driven-microservices/9781492057888/" }
    ],
    tags: ["distributed", "messaging"]
  },
  {
    id: "ddd",
    domain: "cloud-native",
    title: "Domain-Driven Design",
    ext: "md",
    description: "Bounded contexts, ubiquitous language, aggregates, anti-corruption layers. The strategic shape of a system.",
    status: "deep-diving",
    updated: "2026-03",
    subLinks: [
      { label: "Strategic DDD reference — in progress" },
      { label: "Aggregate design checklist — in progress" }
    ],
    external: [
      { label: "DDD Crew patterns", href: "https://github.com/ddd-crew" },
      { label: "Book: DDD (Evans)", href: "https://www.domainlanguage.com/ddd/" },
      { label: "Book: Implementing DDD (Vernon)", href: "https://www.informit.com/store/implementing-domain-driven-design-9780321834577" }
    ],
    tags: ["modeling", "strategy"]
  },
  {
    id: "cloud-cicd",
    domain: "cloud-native",
    title: "CI / CD Pipelines",
    ext: "yaml",
    description: "Trunk-based dev, GitHub Actions workflows, infra-as-code, supply-chain (SLSA, sigstore), blue-green/canary.",
    status: "reference",
    updated: "2026-01",
    subLinks: [
      { label: "GitHub Actions recipe book — in progress" },
      { label: "Supply-chain checklist — in progress" }
    ],
    external: [
      { label: "GitHub Actions docs", href: "https://docs.github.com/en/actions" },
      { label: "SLSA framework", href: "https://slsa.dev/" },
      { label: "Trunk-based development", href: "https://trunkbaseddevelopment.com/" }
    ],
    tags: ["devops", "supply-chain"]
  },

  // ─── Homelab ────────────────────────────────────────────────
  {
    id: "tailscale",
    domain: "homelab",
    title: "Tailscale",
    ext: "conf",
    description: "WireGuard-based overlay mesh. ACLs, MagicDNS, Funnel/Serve, subnet routers, exit nodes.",
    status: "reference",
    updated: "2026-02",
    subLinks: [
      { label: "ACL & tag patterns — in progress" },
      { label: "Subnet router + exit node setup — in progress" }
    ],
    external: [
      { label: "Tailscale docs", href: "https://tailscale.com/kb/" },
      { label: "ACL reference", href: "https://tailscale.com/kb/1018/acls" }
    ],
    tags: ["vpn", "wireguard", "mesh"]
  },
  {
    id: "cloudflare",
    domain: "homelab",
    title: "Cloudflare",
    ext: "conf",
    description: "Tunnels, Access (zero-trust), Workers, R2, DNS. Edge as the front door to a homelab.",
    status: "reference",
    updated: "2026-02",
    subLinks: [
      { label: "Cloudflared tunnel recipes — in progress" },
      { label: "Access policy patterns — in progress" }
    ],
    external: [
      { label: "Cloudflare Tunnel docs", href: "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/" },
      { label: "Cloudflare Access", href: "https://developers.cloudflare.com/cloudflare-one/policies/access/" },
      { label: "Workers", href: "https://developers.cloudflare.com/workers/" }
    ],
    tags: ["edge", "zero-trust", "dns"]
  },
  {
    id: "proxmox",
    domain: "homelab",
    title: "Proxmox VE",
    ext: "conf",
    description: "KVM virtualization + LXC containers. Clustering, ZFS, Ceph, backups with PBS.",
    status: "wip",
    updated: "2026-04",
    subLinks: [
      { label: "Cluster & HA notes — in progress" },
      { label: "PBS backup strategy — in progress" }
    ],
    external: [
      { label: "Proxmox VE docs", href: "https://pve.proxmox.com/pve-docs/" },
      { label: "Proxmox Backup Server", href: "https://pbs.proxmox.com/docs/" }
    ],
    tags: ["virt", "hypervisor", "zfs"]
  },
  {
    id: "private-cloud",
    domain: "homelab",
    title: "Private Cloud Stack",
    ext: "md",
    description: "Self-hosted alternatives to SaaS — storage, identity, observability, GitOps for the homelab.",
    status: "deep-diving",
    updated: "2026-05",
    subLinks: [
      { label: "Service inventory & rationale — in progress" },
      { label: "GitOps with Flux/ArgoCD — in progress" }
    ],
    external: [
      { label: "Awesome-selfhosted", href: "https://awesome-selfhosted.net/" },
      { label: "k3s", href: "https://k3s.io/" },
      { label: "Authentik", href: "https://goauthentik.io/" }
    ],
    tags: ["self-hosted", "gitops", "k8s"]
  }
];

window.STATUSES = [
  { id: "reference",   label: "reference",   blurb: "stable, ready" },
  { id: "wip",         label: "WIP",         blurb: "in progress" },
  { id: "deep-diving", label: "deep-diving", blurb: "actively researching" },
  { id: "wishlist",    label: "wishlist",    blurb: "not yet started" }
];
