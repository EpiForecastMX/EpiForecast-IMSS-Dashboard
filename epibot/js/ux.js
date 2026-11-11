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

  const sidebar = document.getElementById('ccSidebar');
  const menu = document.getElementById('ccMenuBtn');
  const close = document.getElementById('sidebarClose');
  const overlay = document.getElementById('ccOverlay');
  function closeSidebar() {
    sidebar.classList.remove('open'); overlay.classList.remove('open'); menu.setAttribute('aria-expanded','false'); menu.focus();
  }
  close.addEventListener('click', closeSidebar);
  menu.addEventListener('click', () => requestAnimationFrame(() => close.focus()));
  overlay.addEventListener('click', () => menu.focus());
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sidebar.contains(document.activeElement)) closeSidebar();
    if (e.key !== 'Tab' || !sidebar.classList.contains('open') || getComputedStyle(sidebar).position !== 'fixed') return;
    const focusable = [...sidebar.querySelectorAll('a,button,summary')].filter(el => el.getClientRects().length && !el.disabled);
    const first = focusable[0], last = focusable.at(-1);
    if(e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    if(!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  resizeInput();
})();
