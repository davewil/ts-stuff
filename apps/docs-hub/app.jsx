// Main app — chrome, hero, filter, cmd-k palette, tweaks panel, view switcher.
//
// Production additions vs the original design tool export:
//   1. Tweaks persist to localStorage so view/theme/density survive reloads
//      (the design tool's host-postMessage path is no-op outside that host).
//   2. A visible view-switcher control sits in the chrome bar; the hero text
//      tells users to "switch views", so the production page has to provide
//      a way to actually do that.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "view": "atlas",
  "theme": "main",
  "density": "regular",
  "accent": "rose",
  "motion": "on",
  "showHero": true,
  "showStatusbar": true,
  "wallpaper": "aurora",
  "wallpaperIntensity": 0.85
}/*EDITMODE-END*/;

const STORAGE_KEY = "docs-hub:tweaks";

// Merge persisted overrides onto the design's defaults so a stale localStorage
// payload missing a newly-introduced key still gets that key's default.
const INITIAL_TWEAKS = (() => {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return TWEAK_DEFAULTS;
    const stored = JSON.parse(raw);
    if (!stored || typeof stored !== "object") return TWEAK_DEFAULTS;
    return { ...TWEAK_DEFAULTS, ...stored };
  } catch (e) {
    return TWEAK_DEFAULTS;
  }
})();

const ACCENT_MAP = {
  rose: { var: "--rose", hex: { main: "#ebbcba", moon: "#ea9a97", dawn: "#d7827e" } },
  iris: { var: "--iris", hex: { main: "#c4a7e7", moon: "#c4a7e7", dawn: "#907aa9" } },
  foam: { var: "--foam", hex: { main: "#9ccfd8", moon: "#9ccfd8", dawn: "#56949f" } },
  gold: { var: "--gold", hex: { main: "#f6c177", moon: "#f6c177", dawn: "#ea9d34" } },
  love: { var: "--love", hex: { main: "#eb6f92", moon: "#eb6f92", dawn: "#b4637a" } }
};

const VIEW_OPTIONS = [
  { id: "atlas",    label: "Atlas" },
  { id: "terminal", label: "Terminal" },
  { id: "zine",     label: "Zine" },
  { id: "ide",      label: "IDE" }
];

const THEME_OPTIONS = [
  { id: "main", label: "Main" },
  { id: "moon", label: "Moon" },
  { id: "dawn", label: "Dawn" }
];

// Wallpaper picker — "off" plus the five shaders exposed by wallpapers.jsx.
// Stays in lock-step with window.WALLPAPER_KINDS but doesn't import it (this
// file is loaded by Babel-standalone and runs before the global is in scope
// at module-eval time; we redeclare so the chrome select renders deterministically).
const WALLPAPER_OPTIONS = [
  { id: "off",       label: "Off" },
  { id: "aurora",    label: "Aurora" },
  { id: "plasma",    label: "Plasma" },
  { id: "voronoi",   label: "Voronoi" },
  { id: "metaballs", label: "Metaballs" },
  { id: "caustics",  label: "Caustics" }
];

function App() {
  const [t, setTweak] = useTweaks(INITIAL_TWEAKS);

  // Persist tweaks across reloads.
  useEffect(() => {
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(t));
    } catch (e) {
      // private mode / quota — fine to swallow
    }
  }, [t]);

  // Apply theme & density to body
  useEffect(() => {
    document.documentElement.dataset.theme = t.theme;
    document.body.dataset.density = t.density;
    document.body.dataset.motion = t.motion;
    document.body.dataset.view = t.view;
    const accent = ACCENT_MAP[t.accent] || ACCENT_MAP.rose;
    const hex = accent.hex[t.theme] || accent.hex.main;
    document.documentElement.style.setProperty("--rose", hex);
  }, [t.theme, t.density, t.motion, t.accent, t.view]);

  // Filtering state
  const [statusFilter, setStatusFilter] = useState(null);
  const [domainFilter, setDomainFilter] = useState(null);
  const [query, setQuery] = useState("");
  const [cmdkOpen, setCmdkOpen] = useState(false);

  // IDE-mode tab state
  const [openTabs, setOpenTabs] = useState(["typescript", "event-loop"]);
  const [selectedId, setSelectedId] = useState("typescript");

  const openTopic = useCallback((id) => {
    setSelectedId(id);
    setOpenTabs((tabs) => (tabs.includes(id) ? tabs : [...tabs, id]));
  }, []);

  const closeTab = useCallback((id) => {
    setOpenTabs((tabs) => {
      const next = tabs.filter((x) => x !== id);
      if (selectedId === id) {
        setSelectedId(next[next.length - 1] || null);
      }
      return next;
    });
  }, [selectedId]);

  // Group + filter topics
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return window.DOMAINS.map((d) => ({
      domain: d,
      topics: window.TOPICS.filter((topic) => {
        if (topic.domain !== d.id) return false;
        if (statusFilter && topic.status !== statusFilter) return false;
        if (domainFilter && topic.domain !== domainFilter) return false;
        if (!q) return true;
        const hay = (topic.title + " " + topic.description + " " + (topic.tags || []).join(" ")).toLowerCase();
        return hay.includes(q);
      })
    }));
  }, [statusFilter, domainFilter, query]);

  const visibleCount = groups.reduce((n, g) => n + g.topics.length, 0);
  const counts = useMemo(() => {
    const c = { reference: 0, wip: 0, "deep-diving": 0, wishlist: 0 };
    window.TOPICS.forEach((t) => { c[t.status] = (c[t.status] || 0) + 1; });
    return c;
  }, []);

  // Cmd-K keyboard shortcut
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdkOpen((o) => !o);
      } else if (e.key === "Escape") {
        setCmdkOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onPickFromPalette = useCallback((topic) => {
    setCmdkOpen(false);
    if (t.view === "ide") {
      openTopic(topic.id);
    } else if (topic.href) {
      window.location.href = topic.href;
    } else {
      const el = document.getElementById("topic-" + topic.id);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: y, behavior: t.motion === "off" ? "auto" : "smooth" });
        el.animate(
          [{ outline: "2px solid var(--rose)", outlineOffset: "4px" }, { outline: "2px solid transparent", outlineOffset: "4px" }],
          { duration: 1400 }
        );
      }
    }
  }, [t.view, t.motion, openTopic]);

  const viewName = { atlas: "Atlas", terminal: "Terminal", zine: "Zine", ide: "IDE" }[t.view];
  const hasWallpaper = t.wallpaper && t.wallpaper !== "off";

  return (
    <>
      {hasWallpaper && (
        <Wallpaper
          kind={t.wallpaper}
          intensity={t.wallpaperIntensity}
          themeKey={t.theme + ":" + t.accent}
        />
      )}
      <div className="bg-grid" data-dim={hasWallpaper ? "true" : "false"} aria-hidden="true"></div>

      <div className="chrome">
        <div className="dots">
          <span className="dot r"></span><span className="dot y"></span><span className="dot g"></span>
        </div>
        <div className="path">
          ~ / <span className="seg">programming</span> / <span className="cur">{t.view}-view</span><span className="cursor"></span>
        </div>
        <div className="spacer"></div>
        <div className="view-switch" role="radiogroup" aria-label="Layout mode">
          {VIEW_OPTIONS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={t.view === v.id}
              className={"vs-btn" + (t.view === v.id ? " on" : "")}
              onClick={() => setTweak("view", v.id)}
              title={`Switch to ${v.label} view`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="theme-switch" role="radiogroup" aria-label="Theme">
          {THEME_OPTIONS.map((th) => (
            <button
              key={th.id}
              type="button"
              role="radio"
              aria-checked={t.theme === th.id}
              className={"ts-btn" + (t.theme === th.id ? " on" : "")}
              onClick={() => setTweak("theme", th.id)}
              title={`Switch to ${th.label} theme`}
            >
              {th.label}
            </button>
          ))}
        </div>
        <label className="wallpaper-pick" title="Background wallpaper">
          <span className="wp-label">FX</span>
          <select
            className="wp-select"
            value={t.wallpaper}
            onChange={(e) => setTweak("wallpaper", e.target.value)}
            aria-label="Wallpaper"
          >
            {WALLPAPER_OPTIONS.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="tweaks-btn"
          aria-label="Open tweaks"
          title="Advanced tweaks (motion, density, accent, intensity)"
          onClick={() => window.postMessage({ type: "__activate_edit_mode" }, "*")}
        >⚙</button>
        <div className="kbd-hint">
          <span className="kbd">⌘K</span> search
        </div>
      </div>

      {t.showHero && t.view !== "ide" && (
        <header className="hero">
          <div className="eyebrow">
            <span className="pulse"></span>
            cheatsheets &amp; deep dives · last sync {formatDate("2026-05")}
          </div>
          <h1>
            Notes on the <span className="accent">stack</span><br />
            I work in, <span className="accent2">deeply.</span>
          </h1>
          <p className="lede">
            A living library — <strong>cheatsheets, references, and works-in-progress</strong> across the
            languages, runtimes, and infra I keep coming back to. Each card is either ready to use, being
            written, or actively researched. Switch views, filter by status, or hit <strong>⌘K</strong>.
          </p>
          <div className="meta-row">
            <span className="stat"><span className="n">{window.TOPICS.length}</span><span className="l">topics</span></span>
            <span className="stat"><span className="n" style={{color: "var(--foam)"}}>{counts.reference}</span><span className="l">reference</span></span>
            <span className="stat"><span className="n" style={{color: "var(--gold)"}}>{counts.wip}</span><span className="l">WIP</span></span>
            <span className="stat"><span className="n" style={{color: "var(--iris)"}}>{counts["deep-diving"]}</span><span className="l">deep-diving</span></span>
            <span className="stat"><span className="n">{window.DOMAINS.length}</span><span className="l">domains</span></span>
          </div>
        </header>
      )}

      {t.view !== "ide" && (
        <div className="filter">
          <div className="chips">
            <button
              className={"chip" + (statusFilter === null ? " on" : "")}
              onClick={() => setStatusFilter(null)}
            >
              all <span className="ct">{window.TOPICS.length}</span>
            </button>
            {window.STATUSES.map((s) => (
              <button
                key={s.id}
                className={"chip" + (statusFilter === s.id ? " on" : "")}
                data-st={s.id}
                onClick={() => setStatusFilter((cur) => (cur === s.id ? null : s.id))}
              >
                {s.label} <span className="ct">{counts[s.id] || 0}</span>
              </button>
            ))}
          </div>
          <div className="grow"></div>
          <button className="search" onClick={() => setCmdkOpen(true)}>
            <span>⌕</span> search topics
            <span className="k">⌘K</span>
          </button>
        </div>
      )}

      <main className="canvas">
        {visibleCount === 0 && t.view !== "ide" ? (
          <div className="no-results">
            <div className="big">0</div>
            <div>no topics match those filters</div>
            <div style={{ marginTop: "1rem" }}>
              <button
                className="chip"
                style={{ background: "var(--overlay)", color: "var(--rose)", borderColor: "var(--rose)" }}
                onClick={() => { setStatusFilter(null); setDomainFilter(null); setQuery(""); }}
              >reset filters</button>
            </div>
          </div>
        ) : (
          <>
            {t.view === "atlas" && <AtlasView groups={groups} />}
            {t.view === "terminal" && <TerminalView groups={groups} />}
            {t.view === "zine" && <ZineView groups={groups} />}
            {t.view === "ide" && (
              <IdeView
                groups={groups}
                allTopics={window.TOPICS}
                selectedId={selectedId}
                onSelect={openTopic}
                openTabs={openTabs}
                onCloseTab={closeTab}
              />
            )}
          </>
        )}
      </main>

      {t.showStatusbar && <StatusBar visibleCount={visibleCount} counts={counts} view={t.view} statusFilter={statusFilter} />}

      {cmdkOpen && (
        <CommandPalette
          topics={window.TOPICS}
          domains={window.DOMAINS}
          onClose={() => setCmdkOpen(false)}
          onPick={onPickFromPalette}
        />
      )}

      <TweaksPanel>
        <TweakSection label="View" />
        <TweakSelect
          label="Layout mode"
          value={t.view}
          options={[
            { value: "atlas", label: "Atlas — card grid" },
            { value: "terminal", label: "Terminal — file listing" },
            { value: "zine", label: "Zine — editorial" },
            { value: "ide", label: "IDE — workspace" }
          ]}
          onChange={(v) => setTweak("view", v)}
        />
        <TweakSection label="Theme" />
        <TweakRadio
          label="Variant"
          value={t.theme}
          options={["main", "moon", "dawn"]}
          onChange={(v) => setTweak("theme", v)}
        />
        <TweakColor
          label="Accent"
          value={ACCENT_MAP[t.accent].hex[t.theme] || ACCENT_MAP[t.accent].hex.main}
          options={[
            ACCENT_MAP.rose.hex[t.theme] || ACCENT_MAP.rose.hex.main,
            ACCENT_MAP.iris.hex[t.theme] || ACCENT_MAP.iris.hex.main,
            ACCENT_MAP.foam.hex[t.theme] || ACCENT_MAP.foam.hex.main,
            ACCENT_MAP.gold.hex[t.theme] || ACCENT_MAP.gold.hex.main,
            ACCENT_MAP.love.hex[t.theme] || ACCENT_MAP.love.hex.main
          ]}
          onChange={(hex) => {
            const found = Object.entries(ACCENT_MAP).find(([k, v]) => v.hex[t.theme] === hex || v.hex.main === hex);
            if (found) setTweak("accent", found[0]);
          }}
        />
        <TweakSection label="Layout" />
        <TweakRadio
          label="Density"
          value={t.density}
          options={["compact", "regular", "cozy"]}
          onChange={(v) => setTweak("density", v)}
        />
        <TweakToggle label="Motion" value={t.motion === "on"} onChange={(v) => setTweak("motion", v ? "on" : "off")} />
        <TweakToggle label="Show hero" value={t.showHero} onChange={(v) => setTweak("showHero", v)} />
        <TweakToggle label="Show statusbar" value={t.showStatusbar} onChange={(v) => setTweak("showStatusbar", v)} />
        <TweakSection label="Wallpaper" />
        <TweakSelect
          label="Shader"
          value={t.wallpaper}
          options={WALLPAPER_OPTIONS.map((w) => ({ value: w.id, label: w.label }))}
          onChange={(v) => setTweak("wallpaper", v)}
        />
        <TweakSlider
          label="Intensity"
          value={Math.round(t.wallpaperIntensity * 100) / 100}
          min={0}
          max={1.2}
          step={0.05}
          onChange={(v) => setTweak("wallpaperIntensity", v)}
        />
      </TweaksPanel>
    </>
  );
}

// ───────────────────── Statusbar ────────────────────────
function StatusBar({ visibleCount, counts, view, statusFilter }) {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const fmt = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="statusbar" role="status">
      <div className="seg" style={{ color: "var(--foam)" }}>
        ● main
      </div>
      <div className="seg">
        {visibleCount} / {window.TOPICS.length} shown
      </div>
      <div className="seg">
        <span className="dot f"></span>{counts.reference} ref
      </div>
      <div className="seg">
        <span className="dot g"></span>{counts.wip} wip
      </div>
      <div className="seg">
        <span className="dot i"></span>{counts["deep-diving"]} deep
      </div>
      <div className="grow"></div>
      {statusFilter && (
        <div className="seg" style={{ color: "var(--rose)" }}>
          filter: {statusFilter}
        </div>
      )}
      <div className="seg">{view}-view</div>
      <div className="seg">UTF-8</div>
      <div className="seg">{fmt}</div>
    </div>
  );
}

// ───────────────────── Command palette ────────────────────────
function CommandPalette({ topics, domains, onClose, onPick }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) {
      return topics.slice(0, 12).map((t) => ({ topic: t, matched: t.title }));
    }
    const scored = topics
      .map((t) => {
        const title = t.title.toLowerCase();
        const desc = t.description.toLowerCase();
        const tags = (t.tags || []).join(" ").toLowerCase();
        let score = 0;
        if (title.startsWith(query)) score = 100;
        else if (title.includes(query)) score = 80;
        else if (tags.includes(query)) score = 50;
        else if (desc.includes(query)) score = 30;
        return score > 0 ? { topic: t, score } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    return scored;
  }, [q, topics]);

  useEffect(() => { setIdx(0); }, [q]);

  const onKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[idx]) onPick(items[idx].topic);
    }
  };

  const highlight = (text) => {
    const query = q.trim();
    if (!query) return text;
    const i = text.toLowerCase().indexOf(query.toLowerCase());
    if (i < 0) return text;
    return (
      <>
        {text.slice(0, i)}
        <mark>{text.slice(i, i + query.length)}</mark>
        {text.slice(i + query.length)}
      </>
    );
  };

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder="Jump to a topic — type to filter…"
        />
        {items.length === 0 ? (
          <div className="empty">no matches for "{q}"</div>
        ) : (
          <ul className="results" ref={listRef}>
            {items.map((it, i) => {
              const dom = domains.find((d) => d.id === it.topic.domain);
              return (
                <li
                  key={it.topic.id}
                  aria-selected={i === idx}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => onPick(it.topic)}
                >
                  <span className="ic">⌬</span>
                  <span className="ttl">{highlight(it.topic.title)}</span>
                  <span className="dm">{dom?.title}</span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="footer">
          <span><span className="k">↑↓</span>navigate</span>
          <span><span className="k">↵</span>open</span>
          <span><span className="k">esc</span>close</span>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
