# Accessibility follow-ups — docs site

Tracking list of outstanding [WCAG 2.1 / 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/) gaps in `apps/docs-hub/` (React SPA) and `cheatsheets/` (static HTML). What's been fixed and what's left.

The original audit (2026-05-17) ran against both layouts in all three themes (Main, Moon, Dawn). This file is the punch-list version.

## Done

Three commits, deployed to `docs.davewil.dev` + `docs-next.davewil.dev`.

| # | WCAG SC | What | Commit |
|---|---|---|---|
| C4 | 1.4.3 Contrast (AA) | Retune Dawn palette so `--gold` / `--foam` / `--rose` / `--iris` / `--muted` / `--love` clear 4.5:1 vs `--base`. Baked into `[data-theme="dawn"]` tokens and `ACCENT_MAP.<accent>.dawn` in `app.jsx`. | `1785ff6`, de-flagged in `2296850` |
| C5 | 2.4.7 Focus Visible (AA) | Global `:focus-visible` rose outline on `a, button, [role="button"], [role="radio"], [role="tab"], [role="option"], input, select, textarea, summary, [tabindex]` in both stylesheets. | `1785ff6` |
| H2 | 2.4.1 Bypass Blocks (A) | Skip-link as first body child on every page, slides in top-left on first Tab. `id="main"` on every `<main>` landmark. | `1785ff6` |
| H3 | 2.4.11 Focus Not Obscured (AA, 2.2) | `scroll-margin-top: 120px` (hub) / `88px` (cheatsheets) on `:where([id])` so in-page anchors don't land under sticky chrome. | `1785ff6` |
| C1 | 2.1.1 Keyboard (A), 4.1.2 Name/Role/Value (A) | IDE view's `.dom-toggle`, `.file-item`, `.tab` divs now `role` + `tabIndex={0}` + Enter/Space `onKeyDown` handlers. Tab close affordance promoted from `<span>` to `<button>` with `aria-label`. Sidebar collapse/expand buttons got `aria-label`s. | `6e7ebf4`, de-flagged in `2296850` |

Pattern used: each fix shipped behind a `?a11y=1` URL flag first (with persistence to `localStorage["docs-hub:a11y"]`), validated in production over a day, then promoted to default and the flag scaffolding removed. See [STACK_DECISIONS.md](STACK_DECISIONS.md) for why "no trunk-based dev → ship behind a flag" applies to docs-site changes.

## Outstanding

Ordered by severity (Critical first), then by effort to ship.

### Critical

#### C2 — Command palette is not a proper dialog
- **SC:** 4.1.2 (A), 2.4.3 Focus Order (A), 2.4.11 (AA, 2.2)
- **Where:** [apps/docs-hub/app.jsx:524-562](apps/docs-hub/app.jsx#L524) (`CommandPalette` component)
- **Gaps:** no `role="dialog"`, no `aria-modal="true"`, no accessible name on `.cmdk`. Input has no `<label>` / `aria-label` — placeholder isn't an accessible name. No focus trap (Tab escapes into the page underneath). No return-focus to the trigger element on close.
- **Fix sketch:** `role="dialog" aria-modal="true" aria-label="Search topics"` on `.cmdk`, `aria-label="Jump to a topic"` on the `<input>`, focus-trap helper that wraps Tab/Shift-Tab, capture `document.activeElement` on open and restore on `onClose`.
- **Why this is hard:** focus trap + return-focus is the *real* complexity here. ~30 lines of JSX.

#### C3 — Cheatsheets theme switcher: broken radiogroup
- **SC:** 4.1.2 (A)
- **Where:** [cheatsheets/cheatsheets-index.html:76-80](cheatsheets/cheatsheets-index.html#L76) and the same pattern in `event-loop-index.html`. JS in `cheatsheets/tweaks.js` (not yet read in this pass).
- **Gap:** `<div role="radiogroup">` containing plain `<button>` children — no `role="radio"`, no `aria-checked`, no arrow-key navigation. The React hub version (`app.jsx:223-237`) gets this right and is a good reference.
- **Fix sketch:** either drop `role="radiogroup"` (treat as plain buttons with `aria-pressed`), or add `role="radio" aria-checked` + arrow-key handler in `tweaks.js`. Smaller change in tweaks.js (~15 lines).

### High

#### H1 — Cursor blink + hero pulse run forever
- **SC:** 2.2.2 Pause, Stop, Hide (A)
- **Where:** [apps/docs-hub/site.css:138](apps/docs-hub/site.css#L138) `@keyframes blink` / `.chrome .cursor::after { animation: blink … infinite }`; [apps/docs-hub/site.css:195](apps/docs-hub/site.css#L195) `@keyframes pulse` / `.hero .eyebrow .pulse`.
- **Gap:** infinite blink with no built-in stop. `prefers-reduced-motion` and `data-motion="off"` mitigate — but the default is still violating.
- **Fix:** `animation-iteration-count: 4` (or a static caret), and cap the pulse similarly. One-line change each.

#### H4 — Some `target="_blank"` links don't announce new-tab
- **SC:** 3.2.5 (AAA, advisory) / usability
- **Where:** `.res-list a`, `nav.toc` cross-links, `section.preview .open` — many pages.
- **Fix:** either visually-hidden `(opens in new tab)` span, or universal CSS `a[target="_blank"]::after { content: " ↗" }` rule.

### Medium

#### M1 — Touch target size on mobile
- **SC:** 2.5.8 Target Size Minimum (AA, WCAG 2.2)
- **Where:** `.filter .chip` (~22px tall on mobile), `.chrome .vs-btn` / `.ts-btn` (~18-20px), `.tweaks-panel .tp-close` (20×20). Defined in `apps/docs-hub/site.css` and `cheatsheets/styles.css`.
- **Fix:** raise vertical padding to ≥24px (or use `padding` + negative `margin` so visual size stays).

#### M2 — Cheatsheets mobile drawer: audit focus management
- **SC:** 2.4.3 (A), 2.1.2 No Keyboard Trap (A)
- **Where:** `cheatsheets/app.js` (not read in the audit). Burger has `aria-expanded` + `aria-controls` — but need to verify: focus moves into drawer on open, returns to burger on Escape, `<nav class="toc">` gets `aria-hidden`/`inert` while closed.
- **Fix:** read `app.js` and patch as needed.

#### M3 — `TweaksPanel` form labels
- **SC:** 1.3.1 (A), 3.3.2 Labels or Instructions (A)
- **Where:** [apps/docs-hub/tweaks-panel.jsx](apps/docs-hub/tweaks-panel.jsx) (not read in the audit).
- **Fix:** verify each `<TweakSelect>` / `<TweakRadio>` / `<TweakSlider>` / `<TweakToggle>` / `<TweakColor>` pairs an input with a `<label htmlFor>` or `aria-labelledby`.

#### M4 — Dropdown caret SVG hardcoded color
- **SC:** 1.4.11 Non-text Contrast (AA)
- **Where:** [apps/docs-hub/site.css:1175](apps/docs-hub/site.css#L1175), [cheatsheets/styles.css:238](cheatsheets/styles.css#L238) — data-URL SVGs with `fill='%23908caa'`.
- **Gap:** In Dawn this caret is ~2.7:1 vs `--overlay`. With the C4 palette retune this may now pass — re-measure before treating as outstanding.
- **Fix if still failing:** swap the data-URL for `currentColor`, or generate per-theme variants.

#### M5 — IDE welcome state lacks `<h1>`
- **SC:** 1.3.1 (A)
- **Where:** [apps/docs-hub/views.jsx:354-368](apps/docs-hub/views.jsx#L354) — the "Select a file from the sidebar" placeholder uses a `<div className="big">~/notes</div>` styled like a heading.
- **Fix:** wrap in `<h1>` (visually-hidden if it would change the design).

### Low

#### L5 — Status bar's `role="status"` + 30s clock
- **SC:** usability for SR users
- **Where:** [apps/docs-hub/app.jsx:434](apps/docs-hub/app.jsx#L434) — `<div className="statusbar" role="status">`. The clock at line 428 updates every 30s, causing SR re-announcements.
- **Fix:** drop `role="status"` (the bar is informational, not a live region), or move the `<time>` into its own element with `aria-live="off"`.

#### L2 — Wallpaper canvas should be `aria-hidden`
- **SC:** defensive (no actual violation)
- **Where:** `.wallpaper-canvas` element — currently no `aria-hidden`. SRs ignore empty `<canvas>` anyway, but explicit is better.

## Verification

### Color contrast

```bash
# pip install wcag-contrast-ratio
python3 -c "
import wcag_contrast_ratio as w
pairs = [
    ('#faf4ed','#8c5d10'),  # Dawn base × gold
    ('#faf4ed','#2d6873'),  # Dawn base × foam
    ('#faf4ed','#9a4d4a'),  # Dawn base × rose
    ('#faf4ed','#6a657a'),  # Dawn base × muted
    ('#191724','#9ccfd8'),  # Main base × foam
]
for bg, fg in pairs:
    r = w.rgb(tuple(int(bg[i:i+2],16)/255 for i in (1,3,5)),
              tuple(int(fg[i:i+2],16)/255 for i in (1,3,5)))
    print(f'{fg} on {bg}: {r:.2f}:1')
"
```

### Keyboard pass

```bash
# Quick smoke test with Playwright — see the audit transcript on
# 2026-05-17 in the session memory for the full pattern. Cheap version:
# 1. Open in an incognito window with no prior localStorage
# 2. Press Tab → skip-link should appear top-left with rose outline
# 3. Continue Tabbing → focus ring on every interactive element
# 4. Switch to IDE view → Tab into the sidebar, Enter on a file-item
#    should open + select it; Tab to a tab's × button + Enter should
#    close it
```

## Where to track

This file is the source of truth. When tackling an item:

1. Bump it to `## Done` with the commit hash.
2. Mention WCAG SC in the commit message.
3. Tag `hub-v*` / `docs-v*` to trigger deploy (see `.github/workflows/docs-deploy.yml`).
