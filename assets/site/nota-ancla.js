/* nota-ancla.js — ancla estable de una noticia de news.json dentro de novedades.html.
 *
 * id = "nota-" + iso + "-" + título sin tildes, en minúsculas, con guiones, recortado a 48.
 * El backend escribe el mismo enlace en el respaldo estático de la portada
 * (EpiForecast-MX scripts/build_news_weekly.py:nota_ancla); los vectores de prueba son los mismos
 * en ambos repositorios (tests/home.test.mjs y tests/unit/test_build_news_weekly_destino.py).
 * Si dos notas comparten iso y título, la segunda lleva "-2" (orden de news.json).
 */
(function (g) {
  'use strict';
  function slug(s) {
    var t = String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return t.slice(0, 48).replace(/-+$/, '');
  }
  function notaAncla(it) {
    var iso = /^\d{4}-\d{2}-\d{2}$/.test(String(it && it.iso)) ? it.iso : 'sin-fecha';
    return 'nota-' + iso + '-' + (slug(it && it.title) || 'sin-titulo');
  }
  /** Anclas de toda la lista, con sufijo para repetidas. */
  function anclas(items) {
    var vistos = {};
    return (items || []).map(function (it) {
      var a = notaAncla(it);
      vistos[a] = (vistos[a] || 0) + 1;
      return vistos[a] > 1 ? a + '-' + vistos[a] : a;
    });
  }
  /** Anclas antiguas de notas cuyo título cambió: el enlace guardado sigue llevando a la nota. */
  var ALIAS = {
    'nota-2026-11-19-treinta-y-dos-categorias-del-boletin-sin-pronost':
      'nota-2026-11-19-treinta-y-dos-categorias-del-boletin-sin-modelo'
  };
  function anclaVigente(hash) {
    var id = String(hash || '').replace(/^#/, '');
    return Object.prototype.hasOwnProperty.call(ALIAS, id) ? ALIAS[id] : id;
  }
  if (g.document && g.location && g.history) {
    var actual = String(g.location.hash || '').replace(/^#/, '');
    var vigente = anclaVigente(actual);
    if (vigente && vigente !== actual) g.history.replaceState(null, '', '#' + vigente);
  }
  g.EpiNotas = { slug: slug, notaAncla: notaAncla, anclas: anclas, anclaVigente: anclaVigente, ALIAS: ALIAS };
})(typeof window !== 'undefined' ? window : globalThis);
