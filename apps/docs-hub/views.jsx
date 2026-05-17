// Views — four visual presentations of the same topic data.
// Loaded after data.js (window.TOPICS / window.DOMAINS) and React.

const { useState, useEffect, useMemo, useRef, useCallback } = React;

// Behind ?a11y=1 — when on, the IDE view's div-as-button elements get
// tabIndex + Enter/Space key handlers, and the close-tab affordance is
// promoted to a real <button>. Read at render time; bootstrap script in
// index.html sets the attribute before React mounts. The existing
// [data-a11y="on"] :focus-visible rule in site.css supplies the focus ring.
const A11Y_ON = typeof document !== 'undefined'
  && document.documentElement.dataset.a11y === 'on';

// Bind Enter/Space to a click-like handler. Space scrolls by default, so
// preventDefault must run before invoking fn.
const onActivateKey = (fn) => (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fn();
  }
};

// OS-aware modifier label. Duplicated from app.jsx to avoid load-order
// coupling — the function is small and runs only at render time.
function osShortcutLabel(key) {
  const p = (typeof navigator !== 'undefined' && navigator.platform) || '';
  if (/Mac|iPhone|iPad|iPod/.test(p)) return { mod: '⌘', sep: '', key };
  if (/Win/.test(p)) return { mod: 'Win', sep: '+', key };
  return { mod: 'Super', sep: '+', key };
}

// ───────────────────── shared helpers ────────────────────────
function statusLabel(id) {
  return (window.STATUSES.find((s) => s.id === id) || {}).label || id;
}

function formatDate(yyyymm) {
  if (!yyyymm) return "";
  const [y, m] = yyyymm.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

function bytes(t) {
  // fake "size" for terminal mode — derived from title+desc length for stable look
  const n = (t.title + t.description).length * 47 + 1023;
  if (n > 1024) return (n / 1024).toFixed(1) + "K";
  return n + "B";
}

function SubLink({ link }) {
  if (link.href) {
    return <a href={link.href}>{link.label}</a>;
  }
  return <span style={{ color: "var(--muted)" }}>{link.label}</span>;
}

// ───────────────────── ATLAS view (cards) ───────────────────
function AtlasView({ groups }) {
  return (
    <div className="view-atlas">
      {groups.map((g) => (
        <section key={g.domain.id} className="dom-section" data-empty={g.topics.length === 0}>
          <header className="dom">
            <div className="num">{g.domain.num}</div>
            <h2 className="ttl">
              <span className="glyph">{g.domain.glyph}</span>
              {g.domain.title}
            </h2>
            <p className="blurb">{g.domain.blurb}</p>
          </header>
          <div className="grid">
            {g.topics.map((t) => (
              <article key={t.id} id={"topic-" + t.id} className="card-t" data-st={t.status}>
                <div className="head">
                  <h3>
                    {t.href ? <a href={t.href}>{t.title}</a> : t.title}
                  </h3>
                  <span className="ext-badge">.{t.ext}</span>
                </div>
                <p className="desc">{t.description}</p>
                {t.tags && t.tags.length > 0 && (
                  <div className="tags">
                    {t.tags.map((tag) => (
                      <span key={tag} className="tag">#{tag}</span>
                    ))}
                  </div>
                )}
                {t.subLinks && t.subLinks.length > 0 && (
                  <ul className="sub">
                    {t.subLinks.map((l, i) => (
                      <li key={i}><SubLink link={l} /></li>
                    ))}
                  </ul>
                )}
                {t.external && t.external.length > 0 && (
                  <div className="ext">
                    {t.external.map((l, i) => (
                      <a key={i} href={l.href} target="_blank" rel="noopener">{l.label}</a>
                    ))}
                  </div>
                )}
                <div className="foot">
                  <span className="status">
                    <span className="dot"></span>{statusLabel(t.status)}
                  </span>
                  <span>{formatDate(t.updated)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ───────────────────── TERMINAL view ──────────────────────────
function TerminalView({ groups }) {
  return (
    <div className="view-terminal">
      {groups.map((g) => (
        <section key={g.domain.id} className="dom-section" data-empty={g.topics.length === 0}>
          <header className="dom">
            <div className="cmd">ls -la ~/notes/{g.domain.path}</div>
            <p className="blurb">{g.domain.blurb}</p>
          </header>
          <ul className="tlist">
            {g.topics.map((t) => (
              <li key={t.id} id={"topic-" + t.id} className="trow" data-st={t.status}>
                <span className="perm">-rw-r--r--</span>
                <span className="size">{bytes(t)}</span>
                <span className="date">{formatDate(t.updated).toLowerCase()}</span>
                <span className="name">
                  {t.href ? (
                    <a href={t.href}>{t.id}<span className="ext">.{t.ext}</span></a>
                  ) : (
                    <>{t.id}<span className="ext">.{t.ext}</span></>
                  )}
                  <span className="desc">  — {t.description}</span>
                </span>
                <span className="st">[{t.status}]</span>
                <span className="links">
                  {(t.subLinks || []).filter((l) => l.href).slice(0, 1).map((l, i) => (
                    <a key={"s"+i} href={l.href}>read</a>
                  ))}
                  {(t.external || []).slice(0, 1).map((l, i) => (
                    <a key={"e"+i} href={l.href} target="_blank" rel="noopener">docs↗</a>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ───────────────────── ZINE view ──────────────────────────────
// Asymmetric magazine-style layout — sizes cycle so each domain has rhythm.
const ZINE_SHAPES = [
  ["lg", "md", "sm", "sm", "lg"],
  ["md", "lg", "md", "md"],
  ["sm", "sm", "sm", "lg", "md"],
  ["lg", "md", "md"],
  ["md", "sm", "sm", "sm", "lg"]
];
function zineShape(domIdx, topicIdx, count) {
  const pattern = ZINE_SHAPES[domIdx % ZINE_SHAPES.length];
  return pattern[topicIdx % pattern.length];
}

function ZineView({ groups }) {
  return (
    <div className="view-zine">
      {groups.map((g, dIdx) => (
        <section key={g.domain.id} className="dom-section" data-empty={g.topics.length === 0}>
          <header className="dom">
            <div className="num">{g.domain.num}</div>
            <h2 className="ttl">{g.domain.title}</h2>
            <p className="blurb">{g.domain.blurb}</p>
          </header>
          <div className="zgrid">
            {g.topics.map((t, tIdx) => (
              <article
                key={t.id}
                id={"topic-" + t.id}
                className={`zcard ${zineShape(dIdx, tIdx, g.topics.length)}`}
                data-st={t.status}
              >
                <div className="topline">
                  <span>.{t.ext}  ·  {formatDate(t.updated)}</span>
                  <span className="st">{statusLabel(t.status)}</span>
                </div>
                <h3>
                  {t.href ? <a href={t.href}>{t.title}</a> : t.title}
                </h3>
                <p className="desc">{t.description}</p>
                {t.tags && (
                  <div className="meta">
                    {t.tags.map((tag) => (
                      <span key={tag} className="tag">#{tag}</span>
                    ))}
                  </div>
                )}
                <div className="links">
                  {(t.subLinks || []).filter((l) => l.href).map((l, i) => (
                    <a key={"s"+i} href={l.href}>→ {l.label}</a>
                  ))}
                  {t.external && t.external.length > 0 && (
                    <span className="ext-grp">
                      {t.external.map((l, i) => (
                        <a key={"e"+i} href={l.href} target="_blank" rel="noopener">{l.label} ↗</a>
                      ))}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ───────────────────── IDE view ────────────────────────────────
function IdeView({ groups, allTopics, selectedId, onSelect, openTabs, onCloseTab }) {
  const [expanded, setExpanded] = useState(() => {
    const e = {};
    window.DOMAINS.forEach((d) => { e[d.id] = true; });
    return e;
  });
  const toggle = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const selected = allTopics.find((t) => t.id === selectedId);
  const selectedDomain = selected && window.DOMAINS.find((d) => d.id === selected.domain);

  return (
    <>
      <aside className="ide-sidebar">
        <div className="sb-head">
          <span>Explorer</span>
          <div className="actions">
            <button
              type="button"
              title="Collapse all"
              aria-label="Collapse all domain groups"
              onClick={() => {
                const e = {}; window.DOMAINS.forEach((d) => { e[d.id] = false; }); setExpanded(e);
              }}
            >⊟</button>
            <button
              type="button"
              title="Expand all"
              aria-label="Expand all domain groups"
              onClick={() => {
                const e = {}; window.DOMAINS.forEach((d) => { e[d.id] = true; }); setExpanded(e);
              }}
            >⊞</button>
          </div>
        </div>
        {groups.map((g) => (
          <div key={g.domain.id} className="dom-group">
            <div
              className="dom-toggle"
              aria-expanded={expanded[g.domain.id]}
              onClick={() => toggle(g.domain.id)}
              {...(A11Y_ON && {
                role: 'button',
                tabIndex: 0,
                onKeyDown: onActivateKey(() => toggle(g.domain.id)),
              })}
            >
              <span className="caret">▾</span>
              <span>{g.domain.path}/</span>
              <span style={{ color: "var(--muted)", marginLeft: "auto", fontSize: "0.72rem" }}>
                {g.topics.length}
              </span>
            </div>
            {expanded[g.domain.id] && g.topics.map((t) => (
              <div
                key={t.id}
                className="file-item"
                data-st={t.status}
                aria-selected={t.id === selectedId}
                onClick={() => onSelect(t.id)}
                {...(A11Y_ON && {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': `Open ${t.id}.${t.ext}`,
                  onKeyDown: onActivateKey(() => onSelect(t.id)),
                })}
              >
                <span className="icon">⌬</span>
                <span className="name">{t.id}<span className="ext">.{t.ext}</span></span>
                <span className="badge">{t.status === "reference" ? "" : t.status === "wip" ? "U" : t.status === "deep-diving" ? "D" : ""}</span>
              </div>
            ))}
          </div>
        ))}
      </aside>

      <div className="ide-main">
        <div className="ide-tabs">
          {openTabs.map((tabId) => {
            const t = allTopics.find((x) => x.id === tabId);
            if (!t) return null;
            return (
              <div
                key={tabId}
                className="tab"
                aria-selected={tabId === selectedId}
                onClick={() => onSelect(tabId)}
                {...(A11Y_ON && {
                  role: 'tab',
                  tabIndex: 0,
                  'aria-label': `Select tab ${t.id}.${t.ext}`,
                  onKeyDown: onActivateKey(() => onSelect(tabId)),
                })}
              >
                <span className="icon" aria-hidden="true">⌬</span>
                {t.id}.{t.ext}
                {A11Y_ON ? (
                  <button
                    type="button"
                    className="close"
                    aria-label={`Close tab ${t.id}.${t.ext}`}
                    onClick={(e) => { e.stopPropagation(); onCloseTab(tabId); }}
                    onKeyDown={(e) => {
                      // Without this, Enter/Space bubbles to the parent .tab's
                      // onKeyDown which calls onSelect(tabId) → openTopic in
                      // app.jsx re-adds the just-closed tab to openTabs.
                      if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
                    }}
                  >×</button>
                ) : (
                  <span
                    className="close"
                    onClick={(e) => { e.stopPropagation(); onCloseTab(tabId); }}
                  >×</span>
                )}
              </div>
            );
          })}
        </div>

        {selected ? (
          <div className="ide-doc" data-st={selected.status}>
            <div className="docpath">
              <span className="seg">notes</span> / <span className="seg">{selectedDomain.path}</span> / <span style={{ color: "var(--rose)" }}>{selected.id}.{selected.ext}</span>
            </div>
            <h1>{selected.title}</h1>
            <div className="doc-status">
              <span className="dot"></span>
              {statusLabel(selected.status)} · last edited {formatDate(selected.updated)}
            </div>
            <p className="doc-desc">{selected.description}</p>

            {selected.tags && selected.tags.length > 0 && (
              <>
                <div className="doc-sect">// tags</div>
                <div className="doc-list" style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {selected.tags.map((tag) => (
                    <span key={tag} style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.78rem",
                      color: "var(--foam)",
                      background: "var(--overlay)",
                      padding: "0.2rem 0.55rem",
                      borderRadius: "4px"
                    }}>#{tag}</span>
                  ))}
                </div>
              </>
            )}

            {selected.subLinks && selected.subLinks.length > 0 && (
              <>
                <div className="doc-sect">// notes &amp; cheatsheets</div>
                <ul className="doc-list">
                  {selected.subLinks.map((l, i) => (
                    <li key={i}>
                      <span className="icon">📄</span>
                      {l.href ? (
                        <a href={l.href}>{l.label}</a>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>{l.label}</span>
                      )}
                      {l.href && <span className="src">local</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {selected.external && selected.external.length > 0 && (
              <>
                <div className="doc-sect">// external — docs, books, talks</div>
                <ul className="doc-list">
                  {selected.external.map((l, i) => (
                    <li key={i}>
                      <span className="icon">↗</span>
                      <a href={l.href} target="_blank" rel="noopener">{l.label}</a>
                      <span className="src">{(new URL(l.href)).host.replace("www.", "")}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          <div className="ide-doc">
            <div className="welcome">
              <div className="big">~/notes</div>
              <div className="hint">
                Select a file from the sidebar
                <br />
                or press {(() => {
                  const s = osShortcutLabel('K');
                  return <><span className="kbd">{s.mod}</span>{s.sep && <span style={{ margin: '0 0.2rem', color: 'var(--muted)' }}>{s.sep}</span>}<span className="kbd">{s.key}</span></>;
                })()} to search
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

Object.assign(window, { AtlasView, TerminalView, ZineView, IdeView, formatDate, statusLabel });
