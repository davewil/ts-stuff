# ffmpeg / ffprobe cheatsheet — design

Date: 2026-07-09

## Goal

Add a combined ffmpeg + ffprobe cheatsheet to the docs site, following the
established pattern of the existing TypeScript and curl cheatsheets, and
register it in the docs-hub topic taxonomy.

## Decisions

- **One combined page**, not two — `cheatsheets/ffmpeg-cheatsheet.html` covers
  both ffmpeg (transcoding/filters/streaming) and ffprobe (inspection), since
  the tools are used together in practice (probe, then transcode).
- **New docs-hub domain**: `media-tools` ("Media / CLI Tools", num `06`),
  rather than folding ffmpeg into the existing `web` domain. Leaves room for
  future CLI-tool references (imagemagick, jq, etc.) without further domain
  churn.
- **Comprehensive depth**, matching the curl cheatsheet's density (~15
  sections) rather than a lighter everyday-use subset.

## Files touched

| File | Change |
|---|---|
| `cheatsheets/ffmpeg-cheatsheet.html` *(new)* | The cheatsheet itself |
| `cheatsheets/cheatsheets-index.html` | New preview card, "Further reading — ffmpeg" section, updated title/copy (was "TypeScript 6.0 · curl" / "Two standalone pocket references"), updated architecture file-tree, new `.badge.ffmpeg` token color |
| `cheatsheets/index.html` | Landing page's cheatsheets pick-card copy updated to mention all three tools |
| `apps/docs-hub/data.js` | New `media-tools` entry in `window.DOMAINS`; new `ffmpeg` entry in `window.TOPICS` |

## Page structure (`ffmpeg-cheatsheet.html`)

Mirrors `curl-cheatsheet.html`: `<!DOCTYPE html>` boilerplate, inline theme
bootstrap script, shared `styles.css`/`app.js`/`tweaks.js`, skip-link, back-link
nav with theme switch, burger + TOC nav, `<main id="main"><div class="grid">`
of `<section class="card" id="...">` blocks, footer attribution line.

Per-page syntax-token `<style>` block (scoped classes, following the "each
cheatsheet keeps its own token colors" convention noted in the index page's
architecture section):
- `.cmd` — `ffmpeg`/`ffprobe` binary name
- `.flag` — options (`-i`, `-c:v`, `-vf`, …)
- `.path` — input/output filenames
- `.filter` — filter-graph expressions (`scale=1280:-2`, `loudnorm`)
- `.var` — shell variables
- `.comment` — inline `#` comments
- `.op` — pipes/operators

## Sections (in TOC order)

1. Basics — simplest convert, `-i`/`-y`/`-n`, container vs. codec model
2. Codecs & containers — `-c:v`/`-c:a`, `-c copy` remux, common pairings
3. Transcoding & quality — CRF, presets, target bitrate, two-pass
4. Resize & crop — `scale`, `crop`, `pad`, aspect-safe `-2`
5. Trim & concatenate — `-ss`/`-t`/`-to` (input vs. output seek), concat demuxer/filter
6. Filters & filter graphs — `-vf`/`-af` vs. `-filter_complex`, chaining, labels
7. Audio — extract, replace/mux track, `loudnorm`, resample/channel remap
8. Subtitles — burn-in vs. soft-mux, extract, format conversion
9. Thumbnails & GIFs — single-frame, interval extract, two-pass palette GIF
10. Streaming (HLS/DASH/RTMP) — segment muxer output, push to RTMP
11. Hardware acceleration — VideoToolbox, NVENC, VAAPI
12. ffprobe basics — `-show_streams`/`-show_format`
13. ffprobe + JSON — `-of json` piped into `jq`
14. Batch & scripting — directory loop, `xargs -P` parallelism, watch-folder
15. Real-world recipes — compress-for-Slack/email, screen-recording → mp4, still-montage, media health-check

## Taxonomy additions (`data.js`)

```js
// appended to window.DOMAINS
{ id: "media-tools", num: "06", title: "Media / CLI Tools", glyph: "▶",
  blurb: "Codecs, containers, filter graphs — the tools that convert, inspect, and stream video/audio.",
  path: "media-tools" }

// appended to window.TOPICS, new "Media / CLI Tools" comment block
{ id: "ffmpeg", domain: "media-tools", title: "ffmpeg / ffprobe", ext: "sh",
  description: "Transcoding, filter graphs, streaming, hardware acceleration — paired with ffprobe for stream inspection.",
  status: "reference", updated: "2026-07",
  href: "cheatsheets/ffmpeg-cheatsheet.html",
  subLinks: [{ label: "ffmpeg/ffprobe cheatsheet (~15 sections)", href: "cheatsheets/ffmpeg-cheatsheet.html" }],
  external: [ /* resolved during citation verification, see below */ ],
  tags: ["media", "cli", "video"] }
```

## Citation-link verification

Per `CLAUDE.md`'s external-URL policy: every new citation (expected candidates —
FFmpeg documentation home, the Filters reference, the ffprobe doc page, possibly
the FFmpeg Trac wiki) is checked with

```
curl -sIL -o /dev/null -w '%{http_code} %{url_effective}\n' --max-time 10 -A 'Mozilla/5.0' "$url"
```

before being committed. Redirects get updated to their canonical
`url_effective`; 403/429 from bot-blockers get a manual browser check; 404/5xx
get fixed or dropped. The repo's bulk audit script runs once more at the end
since adding a new page is exactly the "re-audit the whole site" trigger it
calls out.

## Verification before done

- Python `html.parser` unclosed-tag check on the new file (matches the existing
  credits-section validation note)
- Browser smoke test: all three themes (Main/Moon/Dawn), skip-link, TOC/burger
  drawer, syntax-token color legibility
- Confirm docs-hub renders the new `media-tools` domain card and `ffmpeg` topic
  entry correctly

## Advisor review findings (addressed pre-plan)

- **C3 a11y defect scope decision**: the theme-switch nav being cloned from
  `curl-cheatsheet.html:24-28` carries the known C3 bug (`role="radiogroup"`
  wrapping plain `<button>`s, no `role="radio"`/`aria-checked`/arrow-key nav).
  Decision: **copy the pattern as-is** for parity with the TS/curl pages, and
  add a line to `A11Y_FOLLOWUPS.md`'s C3 entry noting `ffmpeg-cheatsheet.html`
  now also carries the defect. C3 gets fixed once, site-wide (in shared
  `tweaks.js`), as separate future work — not expanded into this task.
- **Command correctness is the real risk, not structure.** ffmpeg has plenty
  of plausible-but-wrong syntax (concat demuxer flags, two-pass palette GIF,
  `loudnorm` two-pass, input-vs-output `-ss` seek). Every command in every
  section must be grounded in ffmpeg.org docs or actually run — not authored
  from memory, per the repo's "never make things up" rule. The dev machine is
  Apple Silicon: VideoToolbox (§11) can be tested directly; NVENC and VAAPI
  cannot, and must be marked docs-only/untested rather than implied-verified.
  The implementation plan should include a per-section verification checklist,
  not just architectural steps.
- **Pre-check: docs-hub domain rendering is fully data-driven** — confirmed via
  grep of `app.jsx`/`views.jsx`: every domain reference maps over
  `window.DOMAINS` (`.map`, `.find`, `.forEach`), no hardcoded domain count or
  list. The two-entry `data.js` addition (Part 3) is sufficient on its own.
- **Pre-check: `styles.css?v=` cache-bust version.** `index.html` is at `v=6`;
  every existing cheatsheet page (`curl-cheatsheet.html`, `typescript-cheatsheet.html`,
  the event-loop pages) is still pinned at the stale `v=4` left over from
  before the a11y CSS pass (`2296850`). This isn't a content bug — the query
  string doesn't gate which rules are in the file, only client cache
  freshness — but the new page should link `styles.css?v=6` (current, matching
  `index.html`) rather than copying the stale `v=4`. The other pages' stale
  pins are a pre-existing, out-of-scope inconsistency — noted here, not
  silently fixed as a drive-by.
