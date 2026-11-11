/* Progressive enhancement: all destinations remain accessible without JavaScript. */
function toggleMobileNav(button) {
  const menu = document.getElementById('navMobile');
  menu.hidden = !menu.hidden;
  button.setAttribute('aria-expanded', String(!menu.hidden));
  button.setAttribute('aria-label', menu.hidden ? 'Abrir menú' : 'Cerrar menú');
}
(() => {
  const mobile = document.getElementById('navMobile');
  const trigger = document.querySelector('.nav-hamburger');
  function closeMenu() { mobile.hidden = true; trigger.setAttribute('aria-expanded','false'); trigger.setAttribute('aria-label','Abrir menú'); }
  mobile.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && !mobile.hidden) { closeMenu(); trigger.focus(); } });
  window.matchMedia('(min-width: 761px)').addEventListener('change', e => { if(e.matches) closeMenu(); });
  const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const cards = [...document.querySelectorAll('.condition-card')];
  const input = document.getElementById('conditionSearch');
  const group = document.getElementById('conditionGroup');
  const more = document.getElementById('showConditions');
  const count = document.getElementById('catalogCount');
  let expanded = false;
  cards.forEach(card => {
    card.dataset.search = normalize(card.textContent);
    const link = card.querySelector('h3 a').getAttribute('href');
    const catalog = window.EPI_CATALOGO && window.EPI_CATALOGO.releases;
    const pageKey = value => value.replace(/^\//, '').replace(/\.html$/, '').toLowerCase();
    const entry = catalog && catalog.find(r => pageKey(r.pagina) === pageKey(link));
    if (entry) card.dataset.search += ' ' + normalize((entry.alias || []).join(' '));
  });
  function render() {
    const query = normalize(input.value.trim());
    const matching = cards.filter(c => (!group.value || c.dataset.group === group.value) && query.split(/\s+/).every(part => c.dataset.search.includes(part)));
    const searching = Boolean(query || group.value);
    const visible = new Set(matching.slice(0, expanded || searching ? matching.length : 8));
    cards.forEach(c => c.hidden = !visible.has(c));
    count.textContent = searching ? `${matching.length} ${matching.length === 1 ? 'coincidencia' : 'coincidencias'} · ${cards.length} padecimientos disponibles` : `${visible.size} de ${cards.length} padecimientos publicados`;
    more.hidden = searching || matching.length <= 8;
    more.textContent = expanded ? 'Mostrar menos' : `Ver los ${cards.length} padecimientos`;
    more.setAttribute('aria-expanded', String(expanded));
    document.getElementById('noConditions').hidden = matching.length !== 0;
  }
  document.getElementById('catalogControls').hidden = false;
  input.addEventListener('input', render); group.addEventListener('change', render);
  more.addEventListener('click', () => {
    const wasExpanded = expanded; expanded = !expanded; render();
    if(wasExpanded) { document.getElementById('diseases').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); }
  });
  render();
})();
