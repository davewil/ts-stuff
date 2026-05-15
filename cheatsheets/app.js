/* Burger drawer toggle for Rose Pine cheatsheets */
(function () {
  const btn = document.querySelector('.burger');
  const nav = document.getElementById('toc');
  const backdrop = document.querySelector('.nav-backdrop');
  if (!btn || !nav || !backdrop) return;

  function setOpen(open) {
    nav.classList.toggle('open', open);
    backdrop.classList.toggle('open', open);
    document.body.classList.toggle('nav-locked', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? '✕' : '☰';
  }

  btn.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  backdrop.addEventListener('click', () => setOpen(false));

  nav.addEventListener('click', (e) => {
    if (e.target.tagName === 'A' && window.matchMedia('(max-width: 759px)').matches) {
      setOpen(false);
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 760 && nav.classList.contains('open')) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) setOpen(false);
  });
})();

/* Theme switcher — shared with the React hub via the docs-hub:tweaks
   localStorage key, so picking a theme on a cheatsheet syncs to the hub
   and vice-versa. The <head> bootstrap on each page already sets the
   data-theme attribute before CSS applies (no FOUC); this script wires up
   the click handlers and keeps the active-button class in sync. */
(function () {
  const STORAGE_KEY = 'docs-hub:tweaks';
  const VALID = new Set(['main', 'moon', 'dawn']);

  function readPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function writeTheme(theme) {
    try {
      const merged = { ...readPersisted(), theme };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (e) {
      // private mode / quota — ignore
    }
  }

  function currentTheme() {
    const t = document.documentElement.dataset.theme || 'main';
    return VALID.has(t) ? t : 'main';
  }

  function syncButtons(theme) {
    document.querySelectorAll('.theme-switch button[data-theme]').forEach((b) => {
      b.classList.toggle('on', b.dataset.theme === theme);
      b.setAttribute('aria-checked', b.dataset.theme === theme ? 'true' : 'false');
    });
  }

  function applyTheme(theme) {
    if (!VALID.has(theme)) return;
    document.documentElement.dataset.theme = theme;
    syncButtons(theme);
  }

  // Initial sync — the head bootstrap already applied data-theme; reflect
  // that in the button states.
  syncButtons(currentTheme());

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-switch button[data-theme]');
    if (!btn) return;
    const theme = btn.dataset.theme;
    if (!VALID.has(theme)) return;
    applyTheme(theme);
    writeTheme(theme);
  });

  // Cross-tab sync: if another tab/page updates the theme, follow.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    const next = readPersisted().theme;
    if (VALID.has(next) && next !== currentTheme()) applyTheme(next);
  });
})();
