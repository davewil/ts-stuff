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
