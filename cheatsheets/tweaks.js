/* Vanilla tweaks panel for the static cheatsheets. Mirrors the visual style
   of the React TweaksPanel on the hub. Covers the controls that actually apply
   to a cheatsheet page: theme, wallpaper shader, wallpaper intensity, motion.
   Persists to docs-hub:tweaks localStorage (shared with the hub). */

(function () {
  'use strict';

  const STORAGE_KEY = 'docs-hub:tweaks';
  const VALID_THEMES   = ['main', 'moon', 'dawn'];
  const VALID_WALLPAPERS = ['off', 'aurora', 'plasma', 'voronoi', 'metaballs', 'caustics'];

  function readPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) { return {}; }
  }
  function writePersisted(edits) {
    try {
      const merged = { ...readPersisted(), ...edits };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (e) { /* private mode / quota — fine */ }
  }

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') e.className = attrs[k];
        else if (k === 'text') e.textContent = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') {
          e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (attrs[k] != null) {
          e.setAttribute(k, attrs[k]);
        }
      }
    }
    if (children) for (const c of children) if (c != null) e.append(c);
    return e;
  }

  function buildFab() {
    const fab = el('button', {
      class: 'tweaks-fab',
      type: 'button',
      'aria-label': 'Open tweaks',
      title: 'Tweaks (theme, wallpaper, motion)'
    });
    fab.textContent = '⚙';
    document.body.appendChild(fab);
    return fab;
  }

  function buildPanel() {
    const panel = el('div', { class: 'tweaks-panel', role: 'dialog', 'aria-label': 'Tweaks', hidden: '' });

    const header = el('div', { class: 'tp-head' }, [
      el('span', { class: 'tp-title', text: 'Tweaks' }),
      el('button', { class: 'tp-close', type: 'button', 'aria-label': 'Close', text: '✕' })
    ]);
    panel.appendChild(header);

    const body = el('div', { class: 'tp-body' });
    panel.appendChild(body);

    // Theme chip group
    const persisted = readPersisted();
    body.appendChild(el('div', { class: 'tp-section', text: 'Theme' }));
    const themeRow = el('div', { class: 'tp-row' });
    const themeChips = el('div', { class: 'tp-chips', role: 'radiogroup', 'aria-label': 'Theme' });
    VALID_THEMES.forEach((t) => {
      const b = el('button', {
        class: 'tp-chip',
        type: 'button',
        role: 'radio',
        'data-theme': t,
        text: t[0].toUpperCase() + t.slice(1)
      });
      themeChips.appendChild(b);
    });
    themeRow.appendChild(themeChips);
    body.appendChild(themeRow);

    // Wallpaper select
    body.appendChild(el('div', { class: 'tp-section', text: 'Wallpaper' }));
    const wpRow = el('div', { class: 'tp-row tp-row-col' });
    wpRow.appendChild(el('label', { class: 'tp-label', for: 'tp-wallpaper', text: 'Shader' }));
    const wpSelect = el('select', { class: 'tp-select', id: 'tp-wallpaper' });
    VALID_WALLPAPERS.forEach((k) => {
      wpSelect.appendChild(el('option', { value: k, text: k === 'off' ? 'Off' : (k[0].toUpperCase() + k.slice(1)) }));
    });
    wpRow.appendChild(wpSelect);
    body.appendChild(wpRow);

    // Intensity slider
    const intRow = el('div', { class: 'tp-row tp-row-col' });
    const intLabel = el('div', { class: 'tp-label-row' }, [
      el('label', { class: 'tp-label', for: 'tp-intensity', text: 'Intensity' }),
      el('span', { class: 'tp-val', id: 'tp-intensity-val' })
    ]);
    intRow.appendChild(intLabel);
    const intInput = el('input', { class: 'tp-slider', id: 'tp-intensity', type: 'range', min: '0', max: '1.2', step: '0.05' });
    intRow.appendChild(intInput);
    body.appendChild(intRow);

    // Motion toggle
    body.appendChild(el('div', { class: 'tp-section', text: 'Layout' }));
    const motionRow = el('div', { class: 'tp-row tp-row-h' });
    motionRow.appendChild(el('span', { class: 'tp-label', text: 'Motion' }));
    const motionToggle = el('button', { class: 'tp-toggle', type: 'button', role: 'switch', 'aria-checked': 'true' });
    motionToggle.appendChild(el('i'));
    motionRow.appendChild(motionToggle);
    body.appendChild(motionRow);

    document.body.appendChild(panel);
    return { panel, themeChips, wpSelect, intInput, intValEl: panel.querySelector('#tp-intensity-val'), motionToggle, closeBtn: panel.querySelector('.tp-close') };
  }

  function syncControls(refs) {
    const p = readPersisted();
    const theme = VALID_THEMES.indexOf(p.theme) >= 0 ? p.theme : (document.documentElement.dataset.theme || 'main');
    const wallpaper = VALID_WALLPAPERS.indexOf(p.wallpaper) >= 0 ? p.wallpaper : 'aurora';
    const intensity = typeof p.wallpaperIntensity === 'number' ? p.wallpaperIntensity : 0.85;
    const motion = p.motion === 'off' ? false : true;

    refs.themeChips.querySelectorAll('button[data-theme]').forEach((b) => {
      const on = b.dataset.theme === theme;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    refs.wpSelect.value = wallpaper;
    refs.intInput.value = String(intensity);
    refs.intValEl.textContent = intensity.toFixed(2);
    refs.motionToggle.dataset.on = motion ? '1' : '0';
    refs.motionToggle.setAttribute('aria-checked', motion ? 'true' : 'false');
  }

  function wire(refs) {
    // Theme chip click
    refs.themeChips.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-theme]');
      if (!b) return;
      const next = b.dataset.theme;
      if (VALID_THEMES.indexOf(next) < 0) return;
      writePersisted({ theme: next });
      document.documentElement.dataset.theme = next;
      window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
      // also sync the top-bar theme-switch chips (in app.js)
      document.querySelectorAll('.theme-switch button[data-theme]').forEach((tb) => {
        tb.classList.toggle('on', tb.dataset.theme === next);
        tb.setAttribute('aria-checked', tb.dataset.theme === next ? 'true' : 'false');
      });
      syncControls(refs);
    });

    // Wallpaper select
    refs.wpSelect.addEventListener('change', () => {
      const next = refs.wpSelect.value;
      writePersisted({ wallpaper: next });
      if (window.__wallpaperController) window.__wallpaperController.setKind(next);
    });

    // Intensity slider
    refs.intInput.addEventListener('input', () => {
      const v = parseFloat(refs.intInput.value);
      if (Number.isNaN(v)) return;
      refs.intValEl.textContent = v.toFixed(2);
      writePersisted({ wallpaperIntensity: v });
      if (window.__wallpaperController) window.__wallpaperController.setIntensity(v);
    });

    // Motion toggle
    refs.motionToggle.addEventListener('click', () => {
      const on = refs.motionToggle.dataset.on !== '1';
      refs.motionToggle.dataset.on = on ? '1' : '0';
      refs.motionToggle.setAttribute('aria-checked', on ? 'true' : 'false');
      writePersisted({ motion: on ? 'on' : 'off' });
      document.body.dataset.motion = on ? 'on' : 'off';
    });

    // Cross-tab sync — picking up wallpaper change from the hub etc.
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY) return;
      syncControls(refs);
    });
  }

  function mount() {
    if (document.querySelector('.tweaks-panel')) return; // already mounted
    const fab = buildFab();
    const refs = buildPanel();
    const open = () => {
      refs.panel.hidden = false;
      requestAnimationFrame(() => refs.panel.classList.add('open'));
      fab.classList.add('on');
    };
    const close = () => {
      refs.panel.classList.remove('open');
      fab.classList.remove('on');
      setTimeout(() => { refs.panel.hidden = true; }, 180);
    };
    fab.addEventListener('click', () => {
      refs.panel.hidden ? open() : close();
    });
    refs.closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !refs.panel.hidden) close();
    });
    syncControls(refs);
    wire(refs);
    // also reflect persisted motion state on body on first load
    if (readPersisted().motion === 'off') document.body.dataset.motion = 'off';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
