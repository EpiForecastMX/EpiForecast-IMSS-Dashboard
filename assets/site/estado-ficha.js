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

  /* Mesa de la plataforma (25-nov-2026): el texto público no usa la jerga interna del rótulo sellado («gate»,
   * «release»). Sólo cambia cómo se muestra; el rótulo del shard no se toca. */
  function llano(t) {
    return String(t || '').replace(/el gate de aceptación/g, 'la prueba de aceptación de 2025')
      .replace(/gate de aceptación/g, 'prueba de aceptación de 2025').replace(/este release/g, 'este pronóstico publicado');
  }

  function etiqueta(v) {
    if (v && v.portafolio_igual_al_control === true) return SIN_ALTERNATIVA;
    return v && typeof v.publication_label === 'string' ? llano(v.publication_label) : '';
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
    var det = k && corto ? detalle(corto, label) : label;
    // Con detalle, el rótulo corto lleva dos puntos: «Control estacional publicado: portafolio rechazado…».
    if (k) { k.textContent = corto && det && det.charAt(0) !== '(' ? corto + ':' : corto; k.hidden = !corto; }
    if (l) l.textContent = det;
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

  /* Mesa de expertos (24-nov-2026): en un control estacional «64 Modelos finales» sugería un modelado validado. Se dice el
   * método real; la cifra de series publicadas y el error medido se conservan. */
  function cifras(d, v) {
    rotulos(d, v);
    if (tipo(v) !== 'control') return;
    var val = d.getElementById('stModels');
    if (!val) return;
    val.textContent = 'Control';
    var lab = val.parentNode && val.parentNode.querySelector ? val.parentNode.querySelector('.l') : null;
    if (lab) lab.textContent = 'Método: repite los casos de 52 semanas antes';
  }

  /* Mesa de la plataforma (25-nov-2026, ocho asientos; acta en planes/mesa_plataforma_2026-11-25/).
   * Un control estacional nunca se dibuja ni se nombra como pronóstico: línea gris discontinua «Control, no validado» y el
   * observado en verde, como en las gráficas del EpiBot (obesidad_charts.js). Un aceptado conserva sus colores. */
  var GRIS_CONTROL = '#6b6f73';
  function trazo(v) {
    if (tipo(v) === 'control') return { etiqueta: 'Control, no validado', color: GRIS_CONTROL, obs: '#17644d', control: true };
    return { etiqueta: 'Pronóstico congelado', color: '#17644d', obs: '#667d8f', control: false };
  }

  /** Motor de un producto agregado (región o nacional): en un control no hay portafolio. */
  function agregado(v) {
    return tipo(v) === 'control' ? 'Suma de las series estatales del control (repite los casos de 52 semanas antes)' : null;
  }

  /* El sMAPE con 0 casos observados y 0 pronosticados no es «0 % de error»: no hay nada que medir. */
  function sinCasos(o) {
    return !!o && o.semanas > 0 && o.observado_total === 0 && o.pronostico_total === 0;
  }

  /** Error de una serie para mostrar: «sin casos» si 0 frente a 0; si no, el sMAPE con su formato. */
  function errorOos(o, fmt) {
    if (!o || !o.semanas) return '—';
    return sinCasos(o) ? 'sin casos' : fmt(o.smape);
  }

  /* Decisión del autor (25-nov-2026, «muestra los dos»): el sMAPE se muestra siempre junto a los casos observados y
   * esperados de las semanas que mide; con menos de 4 semanas o menos de 20 casos lleva además el aviso de que varía mucho. */
  var NF0 = typeof Intl !== 'undefined' ? new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }) : { format: String };
  function pocos(o) {
    return !!o && o.semanas > 0 && (o.semanas < 4 || (o.observado_total || 0) + (o.pronostico_total || 0) < 20);
  }
  function rotuloOos(o, base) {
    if (!o || !o.semanas) return base + ' (sin semanas aún)';
    var t = base + ' · ' + o.semanas + (o.semanas === 1 ? ' semana: ' : ' semanas: ') + NF0.format(o.observado_total) +
      ' observados frente a ' + NF0.format(o.pronostico_total) + ' esperados';
    return pocos(o) ? t + ' (pocas semanas o pocos casos: varía mucho)' : t;
  }

  function texto(d, sel, t) {
    var el = d.querySelector ? d.querySelector(sel) : null;
    if (el) el.textContent = t;
    return el;
  }

  /* Rótulos que dependen del estado y del número de semanas observadas (mesa de la plataforma). */
  function rotulos(d, v) {
    var nac = v && v.series && v.series['nacional|mx|general'];
    var n = nac && nac.oos ? nac.oos.semanas : 0;
    var st = d.getElementById && d.getElementById('stOos');
    var lab = st && st.parentNode && st.parentNode.querySelector ? st.parentNode.querySelector('.l') : null;
    if (lab && n) lab.textContent = rotuloOos(nac.oos, 'sMAPE nacional fuera de muestra');
    if (st && sinCasos(nac && nac.oos)) st.textContent = 'Sin casos';
    if (tipo(v) !== 'control' || !d.querySelector) return;
    texto(d, '#explorador h2', 'Control estacional frente a lo observado');
    texto(d, '#explorador > .wrap > p', 'Elige una geografía y un sexo. La línea verde es lo observado en el boletín; la gris discontinua, el control estacional, que repite los casos de 52 semanas antes y no está validado. La franja sombreada marca las semanas del control que ya se observaron.');
    var sw = d.querySelector('.legend .sw-fc');
    if (sw && sw.parentNode) {
      sw.style.borderTopColor = GRIS_CONTROL;
      sw.parentNode.lastChild.textContent = 'Control, no validado';
    }
    var sb = d.querySelector('.legend .sw-band');
    if (sb && sb.parentNode) sb.parentNode.lastChild.textContent = 'Semanas ya observadas del control';
    var so = d.querySelector('.legend .sw-obs');
    if (so) so.style.background = '#17644d';
    var h4 = d.querySelector('#metodologia .step:nth-child(2) h4');
    if (h4 && /^\d+ modelos, uno por serie base$/.test(h4.textContent)) h4.textContent = 'Una serie base por entidad y sexo';
  }

  /* Selector de sexo (role="radiogroup"): flechas, Inicio y Fin mueven y eligen; sólo el elegido entra en el orden de tabulación. */
  function radiogrupo(grupo) {
    if (!grupo || grupo.__epiRadio) return;
    grupo.__epiRadio = true;
    var botones = function () { return Array.prototype.slice.call(grupo.querySelectorAll('[role="radio"]')); };
    var marca = function () { botones().forEach(function (b) { b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1; }); };
    marca();
    grupo.addEventListener('click', function () { setTimeout(marca, 0); });
    grupo.addEventListener('keydown', function (e) {
      var bs = botones(), i = bs.indexOf(e.target);
      if (i < 0) return;
      var j = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: bs.length - 1 }[e.key];
      if (j === undefined) return;
      e.preventDefault();
      var b = bs[(j + bs.length) % bs.length];
      b.focus(); b.click();
    });
  }

  /* Filas de la tabla de entidades: se eligen también con el teclado (Intro o espacio). */
  function filaTeclado(tr, nombre) {
    tr.tabIndex = 0;
    tr.setAttribute('aria-label', 'Ver ' + nombre + ' en el explorador');
    tr.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tr.click(); }
    });
  }

  /** Resumen de la gráfica para lectores de pantalla (el lienzo no se lee). */
  function resumenGrafica(s, v, nf) {
    var t = trazo(v), o = s.oos || {};
    var ult = s.observado.filter(function (p) { return p[1] != null; }).slice(-1)[0];
    var partes = [s.nombre + ', ' + s.sexo_nombre + '.'];
    if (ult) partes.push('Último observado: ' + nf.format(ult[1]) + ' casos en la semana del ' + ult[0] + '.');
    partes.push((t.control ? 'Control estacional, no validado: ' : 'Pronóstico congelado: ') + nf.format(s.pronostico_52_total) + ' casos en 52 semanas.');
    if (o.semanas) partes.push('En ' + o.semanas + (o.semanas === 1 ? ' semana ya observada' : ' semanas ya observadas') + ' se reportaron ' + nf.format(o.observado_total) + ' casos.');
    return partes.join(' ');
  }

  if (g.document && g.document.addEventListener) {
    g.document.addEventListener('DOMContentLoaded', function () { radiogrupo(g.document.getElementById('segSexo')); });
  }

  g.EpiEstadoFicha = { CORTO: CORTO, SIN_ALTERNATIVA: SIN_ALTERNATIVA, GRIS_CONTROL: GRIS_CONTROL, llano: llano, etiqueta: etiqueta, tipo: tipo, detalle: detalle, aplica: aplica, cifras: cifras, rotulos: rotulos, trazo: trazo, agregado: agregado, sinCasos: sinCasos, errorOos: errorOos, pocos: pocos, rotuloOos: rotuloOos, radiogrupo: radiogrupo, filaTeclado: filaTeclado, resumenGrafica: resumenGrafica, semanaMas: semanaMas, semanasDelAnio: semanasDelAnio };
})(typeof window !== 'undefined' ? window : globalThis);
