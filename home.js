/* home.js — portada: noticias desde news.json y catálogo compacto con búsqueda.
 * Mejora progresiva: sin JavaScript se ven el banner estático de noticias y las 35 tarjetas.
 * El menú y la cabecera viven en assets/site/site-nav.js; la vista previa, en home-preview.js.
 */
(function () {
  'use strict';
  /** Igual que normalizeText de Reports/galeria_core.mjs: sin tildes, minúsculas, espacios simples. */
  var normalize = function (s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  };

  // ── Noticias: 1 principal + 2 secundarias, cada una con el ancla de su nota en novedades.html ──
  (function renderNewsBanner() {
    var row = document.getElementById('newsBannerRow');
    if (!row || !window.EpiNotas) return;
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function plain(html) {
      var d = document.createElement('div'); d.innerHTML = html || '';
      return (d.textContent || '').replace(/\s+/g, ' ').trim();
    }
    function summary(it) {
      if (it.summary) return esc(it.summary);
      var t = plain((it.body || [])[0] || '');
      return esc(t.length > 150 ? t.slice(0, 147).replace(/\s+\S*$/, '') + '…' : t);
    }
    var tipo = function (it) { return esc(it.type) || 'datos'; };
    fetch('news.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !Array.isArray(d.items) || !d.items.length) return;
        var ids = window.EpiNotas.anclas(d.items);
        var top = d.items.slice(0, 3);
        var lead = top[0];
        row.innerHTML = '<a href="novedades.html#' + ids[0] + '" class="news-lead">' +
          '<div class="news-lead-meta"><span class="news-date">' + esc(lead.date) + '</span>' +
          '<span class="news-tag news-tag--' + tipo(lead) + '">' + esc(lead.tag) + '</span></div>' +
          '<div class="news-lead-title">' + esc(lead.title) + '</div>' +
          '<div class="news-lead-sub">' + summary(lead) + '</div></a>' +
          '<div class="news-mini-list">' + top.slice(1).map(function (it, i) {
            return '<a href="novedades.html#' + ids[i + 1] + '" class="news-mini">' +
              '<span class="news-tag news-tag--' + tipo(it) + '">' + esc(it.tag) + '</span>' +
              '<span class="news-mini-title">' + esc(it.title) + '</span>' +
              '<span class="news-mini-date">' + esc(it.date) + '</span></a>';
          }).join('') + '</div>';
      })
      .catch(function () { /* queda el respaldo estático */ });
  })();

  // ── Total de padecimientos publicados: cohorte original (4) + releases del catálogo ──
  var count = document.getElementById('countPadecimientos');
  if (count && window.EPI_CATALOGO) count.textContent = String(4 + window.EPI_CATALOGO.releases.length);

  // ── Catálogo compacto: 8 al inicio, búsqueda normalizada sobre los 35 ──
  var INICIALES = 8;
  var cards = Array.prototype.slice.call(document.querySelectorAll('.condition-card'));
  var input = document.getElementById('conditionSearch');
  var group = document.getElementById('conditionGroup');
  var more = document.getElementById('showConditions');
  var countEl = document.getElementById('catalogCount');
  var none = document.getElementById('noConditions');
  if (!cards.length || !input || !group || !more) return;
  var expanded = false;
  var catalog = window.EPI_CATALOGO && window.EPI_CATALOGO.releases;
  cards.forEach(function (card) {
    var extra = '';
    var entry = catalog && catalog.filter(function (r) { return r.id === card.dataset.p; })[0];
    if (entry) extra = ' ' + (entry.alias || []).join(' ') + ' ' + (entry.nombre || '') + ' ' + (entry.cie || '');
    card.dataset.search = normalize(card.textContent + extra);
  });
  function render() {
    var query = normalize(input.value);
    var parts = query ? query.split(' ') : [];
    var matching = cards.filter(function (c) {
      return (!group.value || c.dataset.group === group.value) && parts.every(function (p) { return c.dataset.search.indexOf(p) !== -1; });
    });
    var searching = Boolean(query || group.value);
    var visible = new Set(matching.slice(0, expanded || searching ? matching.length : INICIALES));
    cards.forEach(function (c) { c.hidden = !visible.has(c); });
    countEl.textContent = searching
      ? matching.length + ' ' + (matching.length === 1 ? 'coincidencia' : 'coincidencias') + ' de ' + cards.length + ' padecimientos'
      : visible.size + ' de ' + cards.length + ' padecimientos publicados';
    more.hidden = searching || matching.length <= INICIALES;
    more.textContent = expanded ? 'Mostrar menos' : 'Ver los ' + cards.length + ' padecimientos';
    more.setAttribute('aria-expanded', String(expanded));
    none.hidden = matching.length !== 0;
  }
  document.getElementById('catalogControls').hidden = false;
  input.addEventListener('input', render);
  group.addEventListener('change', render);
  more.addEventListener('click', function () {
    var was = expanded; expanded = !expanded; render();
    if (was) document.getElementById('diseases').scrollIntoView();
    else { var first = cards[INICIALES] && cards[INICIALES].querySelector('h3 a'); if (first) first.focus(); }
  });
  render();
})();
