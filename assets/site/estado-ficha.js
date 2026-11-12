/* estado-ficha.js — estado de publicación de una ficha desde SU vista (publication/<id>/vista.json).
 *
 * La misma semántica que el catálogo del Dashboard y la Galería (assets/dashboard/unified.mjs
 * statusFromView y Reports/galeria_core.mjs STATUS_SHORT): PASS → superada; CONTROL_ONLY → control;
 * INCOMPLETE → control si la etiqueta publicada dice «control estacional» (portafolio rechazado,
 * caída al control) y, si no, validación en curso. No cambia criterios, veredicto ni datos: sólo los
 * lee y los refleja en la tarjeta de estado como texto explícito y como atributos
 *   data-verdict="<veredicto literal>" data-publication-kind="pass|pending|control"
 * que disease.css colorea (verde, azul neutro, ocre). Un veredicto desconocido o FAIL no recibe
 * color: la tarjeta queda neutra con la etiqueta literal. Las pruebas (tests/fichas.test.mjs)
 * comparan este resultado con statusFromView sobre todas las vistas publicadas.
 */
(function (g) {
  'use strict';
  var CORTO = {
    pass: 'Validación prospectiva superada',
    pending: 'Validación prospectiva en curso',
    control: 'Control estacional publicado',
  };
  var CONTROL_RE = /control estacional/i;

  function tipo(v) {
    var verdict = v && v.verdict;
    var label = v && typeof v.publication_label === 'string' ? v.publication_label : '';
    if (verdict === 'PASS') return 'pass';
    if (verdict === 'CONTROL_ONLY') return 'control';
    if (verdict === 'INCOMPLETE') return CONTROL_RE.test(label) ? 'control' : 'pending';
    return null;
  }

  /** El detalle no repite el rótulo corto (como entryFacts de la Galería). */
  function detalle(corto, label) {
    return corto && label.indexOf(corto) === 0 ? label.slice(corto.length).replace(/^[\s·:,-]+/, '') : label;
  }

  function aplica(card, v, doc) {
    var d = doc || g.document;
    var kind = tipo(v);
    var label = v && typeof v.publication_label === 'string' ? v.publication_label : '';
    card.setAttribute('data-verdict', String((v && v.verdict) || ''));
    if (kind) card.setAttribute('data-publication-kind', kind);
    else card.removeAttribute('data-publication-kind');
    var corto = kind ? CORTO[kind] : '';
    var k = d.getElementById('pubKind');
    var l = d.getElementById('pubLabel');
    if (k) { k.textContent = corto; k.hidden = !corto; }
    if (l) l.textContent = k && corto ? detalle(corto, label) : label;
    return kind;
  }

  g.EpiEstadoFicha = { CORTO: CORTO, tipo: tipo, detalle: detalle, aplica: aplica };
})(typeof window !== 'undefined' ? window : globalThis);
