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
  /* Portafolio igual al control (rolling_cv_historia_corta_2024_v1, un año de historia): el único candidato fue el
   * control estacional, así que se presenta como control publicado, nunca como validación en curso, aunque la
   * etiqueta sellada del shard diga «Validación prospectiva en curso». Misma frase que unified.mjs. */
  var SIN_ALTERNATIVA = 'Control estacional publicado: con un año de historia no hubo alternativa que elegir, no validado y sin validación prospectiva propia · pronóstico puntual sin intervalos';

  function etiqueta(v) {
    if (v && v.portafolio_igual_al_control === true) return SIN_ALTERNATIVA;
    return v && typeof v.publication_label === 'string' ? v.publication_label : '';
  }

  function tipo(v) {
    var verdict = v && v.verdict;
    var label = etiqueta(v);
    if (verdict === 'PASS') return 'pass';
    if (verdict === 'CONTROL_ONLY') return 'control';
    if (verdict === 'INCOMPLETE') return CONTROL_RE.test(label) ? 'control' : 'pending';
    return null;
  }

  /** El detalle no repite el rótulo corto (como entryFacts de la Galería). */
  function detalle(corto, label) {
    return corto && label.indexOf(corto) === 0 ? label.slice(corto.length).replace(/^[\s·:,-]+/, '') : label;
  }

  /* Mesa de expertos sobre iconografía (24-nov-2026): el icono del estado sale del sprite común. El control estacional
   * lleva el ciclo de repetición, nunca el reloj (que se leía como «validación en curso») ni la palomita. */
  var ICONO = { pass: 'i-estado-validado', pending: 'i-estado-en-validacion', control: 'i-estado-control' };
  function icono(card, kind, d) {
    var svg = card.querySelector && card.querySelector('.status-badge svg');
    if (!svg || !ICONO[kind] || !d.createElementNS) return;
    var ns = 'http://www.w3.org/2000/svg';
    var use = d.createElementNS(ns, 'use');
    use.setAttribute('href', 'assets/site/icons.svg#' + ICONO[kind]);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('data-icono', ICONO[kind]);
    svg.appendChild(use);
  }

  function aplica(card, v, doc) {
    var d = doc || g.document;
    var kind = tipo(v);
    var label = etiqueta(v);
    card.setAttribute('data-verdict', String((v && v.verdict) || ''));
    if (kind) card.setAttribute('data-publication-kind', kind);
    else card.removeAttribute('data-publication-kind');
    var corto = kind ? CORTO[kind] : '';
    var k = d.getElementById('pubKind');
    var l = d.getElementById('pubLabel');
    if (k) { k.textContent = corto; k.hidden = !corto; }
    if (l) l.textContent = k && corto ? detalle(corto, label) : label;
    icono(card, kind, d);
    return kind;
  }

  /* Semana epidemiológica (domingo–sábado, regla del 4 de enero; misma que epibot/js/calendario_boletin.js y
   * epi_calendar.py) desplazada k semanas. Para rótulos de la ficha que hoy hacen `semana + 1` a mano: la semana
   * del boletín que publica un corte (k = rezago impreso del cuadro, 0 o 1) y la primera semana fuera de muestra
   * (k = 1). Cruza 52/53 → 1 con el calendario; una semana fuera de rango es error, no se corrige en silencio. */
  var DIA = 86400000;
  function inicioAnio(y) { var j4 = Date.UTC(y, 0, 4); return j4 - new Date(j4).getUTCDay() * DIA; }
  function semanasDelAnio(y) { return Math.round((inicioAnio(y + 1) - inicioAnio(y)) / (7 * DIA)); }
  function semanaMas(year, week, k) {
    var y = Number(year), w = Number(week), d = k === undefined ? 1 : Number(k);
    if (!(y % 1 === 0 && w % 1 === 0 && d % 1 === 0) || w < 1 || w > semanasDelAnio(y)) {
      throw new RangeError('Semana epidemiológica no válida: ' + year + '-W' + week + ' (+' + k + ')');
    }
    var t = inicioAnio(y) + (w - 1 + d) * 7 * DIA, a = new Date(t).getUTCFullYear() + 1;
    while (inicioAnio(a) > t) a--;
    return [a, Math.floor((t - inicioAnio(a)) / (7 * DIA)) + 1];
  }

  g.EpiEstadoFicha = { CORTO: CORTO, SIN_ALTERNATIVA: SIN_ALTERNATIVA, etiqueta: etiqueta, tipo: tipo, detalle: detalle, aplica: aplica, semanaMas: semanaMas, semanasDelAnio: semanasDelAnio };
})(typeof window !== 'undefined' ? window : globalThis);
