/* Presentation-only enhancements. Answers, routing and published data remain in app.js/kb.js. */
(() => {
  function keyboardIsOpen() {
    const viewport = window.visualViewport;
    const editing = document.activeElement?.matches('input, textarea, [contenteditable="true"]');
    return Boolean(viewport && editing && viewport.scale === 1 && window.innerHeight - viewport.height > 150);
  }
  function syncKeyboard() { document.body.classList.toggle('keyboard-open', keyboardIsOpen()); }
  window.visualViewport?.addEventListener('resize', syncKeyboard);
  document.addEventListener('focusin', syncKeyboard);
  document.addEventListener('focusout', () => requestAnimationFrame(syncKeyboard));
  syncKeyboard();
  const input = document.getElementById('inputField');
  function resizeInput() { input.style.height = 'auto'; input.style.height = Math.min(144, Math.max(46, input.scrollHeight)) + 'px'; }
  input.addEventListener('input', resizeInput);
  input.addEventListener('keydown', () => requestAnimationFrame(resizeInput));
  document.getElementById('sendBtn').addEventListener('click', () => requestAnimationFrame(resizeInput));
  document.getElementById('resetBtn').addEventListener('click', () => requestAnimationFrame(resizeInput));

  const search = document.getElementById('promptSearch');
  const status = document.getElementById('promptSearchStatus');
  const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function filterPrompts() {
    const query = normalize(search.value.trim()); let count = 0;
    document.querySelectorAll('.prompt-cat').forEach(group => {
      const category = group.querySelector('.prompt-cat-label')?.textContent || '';
      let visible = 0;
      group.querySelectorAll('.prompt-item').forEach(button => {
        const haystack = normalize(category + ' ' + button.textContent + ' ' + (button.dataset.q || ''));
        button.hidden = !query.split(/\s+/).every(word => haystack.includes(word));
        if (!button.hidden) visible++;
      });
      group.hidden = visible === 0; count += visible;
    });
    status.textContent = query ? (count ? `${count} ${count === 1 ? 'consulta disponible' : 'consultas disponibles'}` : 'Sin coincidencias. Prueba otro padecimiento o término.') : 'Filtra por padecimiento o por lo que quieres consultar.';
  }
  search.addEventListener('input', filterPrompts);
  document.getElementById('promptToggle').addEventListener('click', () => requestAnimationFrame(() => {
    if (document.getElementById('promptMenu').classList.contains('open')) { filterPrompts(); search.focus(); }
  }));
  document.getElementById('promptMenuClose').addEventListener('click', () => document.getElementById('promptToggle').focus());
  new MutationObserver(() => { if (search.value) filterPrompts(); }).observe(document.getElementById('promptEntidades'), { childList: true });

  // Panel lateral de EPI («Herramientas»): en ≤ 1024 px es un cajón. Un solo manejador para abrir,
  // cerrar (botón, capa, Escape), foco y acciones rápidas; antes había otro en línea en index.html.
  const sidebar = document.getElementById('ccSidebar');
  const menu = document.getElementById('ccMenuBtn');
  const close = document.getElementById('sidebarClose');
  const overlay = document.getElementById('ccOverlay');
  const send = document.getElementById('sendBtn');
  // Dos menús (plataforma y panel local): al abrir el cajón se cierra el de la plataforma y .cc sube
  // de capa (.cc--drawer-open, respaldo de :has en shell.css) para quedar sobre la barra común.
  const cc = sidebar.closest('.cc');
  const platformToggle = document.querySelector('.site-nav__toggle');
  const isOpen = () => sidebar.classList.contains('open');
  function setSidebar(open, focusBack) {
    sidebar.classList.toggle('open', open);
    overlay.classList.toggle('open', open);
    menu.setAttribute('aria-expanded', String(open));
    if (cc) cc.classList.toggle('cc--drawer-open', open);
    if (open && platformToggle && platformToggle.getAttribute('aria-expanded') === 'true') platformToggle.click();
    if (open) requestAnimationFrame(() => close.focus());
    else if (focusBack) menu.focus();
  }
  menu.addEventListener('click', () => setSidebar(true));
  close.addEventListener('click', () => setSidebar(false, true));
  overlay.addEventListener('click', () => setSidebar(false, true));
  // Acciones rápidas del panel: llenan la pregunta y la envían (app.js atiende #sendBtn).
  sidebar.querySelectorAll('[data-q]').forEach(el => el.addEventListener('click', () => {
    input.value = el.dataset.q;
    send.click();
    input.focus();
  }));
  // En el cajón (móvil), cualquier acción o enlace del panel lo cierra.
  sidebar.querySelectorAll('[data-q], a').forEach(el => el.addEventListener('click', () => {
    if (window.innerWidth <= 1024 && isOpen()) setSidebar(false);
  }));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen()) { setSidebar(false, true); return; }
    if (e.key !== 'Tab' || !isOpen() || getComputedStyle(sidebar).position !== 'fixed') return;
    const focusable = [...sidebar.querySelectorAll('a,button,summary')].filter(el => el.getClientRects().length && !el.disabled);
    const first = focusable[0], last = focusable.at(-1);
    if(e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    if(!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  resizeInput();
})();
