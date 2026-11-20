// Panel «Pronóstico» del radar del boletín, junto a la serie observada de cada categoría.
// Publicados: la serie nacional de su vista (publication/<id>/vista.json) o, en el carril original, los datos de
// la Figura 1 de la portada (hero_series.json). Sin release: el pronóstico exploratorio, no validado, de la foto
// vigente (pronostico_exploratorio.json), con su rótulo, su motivo y su advertencia. No calcula cifras: las lee.
import { numero } from './celdas.mjs?v=1';
import { fuentePronostico, desdeVista, desdeLegacy, desdeExploratorio } from './pronostico.mjs?v=9';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (n == null ? 'Sin dato' : Number(n).toLocaleString('es-MX', { maximumFractionDigits: 1 }));
const OBSERVADO_SEMANAS = 104;

let DATA = null, EXPL = null, INDICE = null, modo = 'serie', actualId = null, pedido = 0;
const cache = new Map();
async function json(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(`No se pudo cargar ${url}`); return r.json(); }));
  }
  try { return await cache.get(url); } catch (e) { cache.delete(url); throw e; }
}

let base = null;
function cargarBase() {
  // Una sola carga compartida: dos renders simultáneos no deben ver la foto a medio cargar.
  base ??= (async () => {
    const actual = await json('/assets/boletin/actual.json');
    const [d, x, i] = await Promise.all([json(`/${actual.carpeta}/data.json`),
      json(`/${actual.carpeta}/pronostico_exploratorio.json`), json('/assets/boletin/history/index.json')]);
    DATA = d; EXPL = x; INDICE = i;
  })().catch((e) => { base = null; throw e; });
  return base;
}

/** Serie nacional semanal impresa del histórico, como [{ds, y}] (sin huecos convertidos en ceros). */
async function observadoImpreso(e) {
  const ref = INDICE.series?.[e.id];
  if (!ref) return [];
  const serie = await json(ref.path);
  const inicio = new Map(INDICE.periods.map((p) => [`${p.y}-${p.w}`, p.start]));
  return serie.points.map((p) => ({ ds: inicio.get(`${p.y}-${p.w}`), y: numero(p.n?.[0], e.guion, p.y) }))
    .filter((p) => p.ds && p.y !== null);
}

async function modelo(id) {
  const e = DATA.diseases.find((x) => x.id === id);
  if (!e) return { aviso: 'Esta clasificación histórica no está en la foto vigente del boletín: su serie se conserva en el archivo, pero no tiene pronóstico.' };
  const f = fuentePronostico(e);
  if (!f) return { nombre: e.name, aviso: 'Este bloque es un agregado de subtipos que el catálogo ya cuenta por separado: el pronóstico se consulta en cada subtipo.' };
  if (f.tipo === 'publicado') {
    return f.legacy ? desdeLegacy(await json('/hero_series.json'), f.id) : desdeVista(await json(`/publication/${f.id}/vista.json`), f.id);
  }
  return desdeExploratorio(EXPL, e.id, await observadoImpreso(e));
}

function grafica(m) {
  const obs = m.observado.slice(-OBSERVADO_SEMANAS), pro = m.pronostico.filter((p) => p.y != null);
  const todos = [...obs, ...pro];
  if (!todos.length) return '';
  const W = 960, H = 340, L = 83, R = 24, T = 24, B = 60, pw = W - L - R, ph = H - T - B;
  const t = (ds) => Date.parse(`${ds}T00:00:00Z`);
  // Con el rótulo dentro de la gráfica se deja espacio arriba para que la línea no lo cubra.
  const t0 = t(todos[0].ds), t1 = t(todos.at(-1).ds), max = Math.max(1, ...todos.map((p) => p.y)) * (m.tipo === 'exploratorio' ? 1.35 : 1.08);
  const X = (ds) => L + ((t(ds) - t0) / Math.max(1, t1 - t0)) * pw, Y = (v) => T + (1 - v / max) * ph;
  const ruta = (ps) => ps.map((p, i) => `${i ? 'L' : 'M'}${X(p.ds).toFixed(2)},${Y(p.y).toFixed(2)}`).join(' ');
  const clase = m.tipo === 'exploratorio' ? 'forecast-line forecast-line--exploratorio' : 'forecast-line';
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="forecastSvgTitle forecastSvgDesc"><title id="forecastSvgTitle">${esc(m.nombre)}: ${esc(m.tipo === 'exploratorio' ? m.rotulo : 'pronóstico publicado')}</title><desc id="forecastSvgDesc">Serie observada de las últimas semanas y ${pro.length} semanas de pronóstico desde ${esc(m.origen)}. ${esc(m.rotulo)}.</desc>`;
  for (let i = 0; i <= 5; i++) {
    const v = (max * i) / 5, y = Y(v);
    svg += `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" class="curve-grid"/><text x="${L - 12}" y="${y + 4}" text-anchor="end" class="curve-tick">${esc((max < 10 ? Math.round(v * 10) / 10 : Math.round(v)).toLocaleString('es-MX'))}</text>`;
  }
  // Una marca por año, en su primera semana (la que empieza entre el 29 de diciembre y el 4 de enero).
  const anios = new Map();
  for (const p of todos) {
    const [y, mm, dd] = p.ds.split('-').map(Number), a = mm === 12 && dd >= 29 ? y + 1 : y;
    if ((mm === 1 && dd <= 4) || (mm === 12 && dd >= 29)) if (!anios.has(a)) anios.set(a, p.ds);
  }
  for (const [a, ds] of anios) svg += `<text x="${X(ds)}" y="${H - B + 24}" text-anchor="middle" class="curve-tick">${a}</text>`;
  if (pro.length) svg += `<line x1="${X(pro[0].ds)}" y1="${T}" x2="${X(pro[0].ds)}" y2="${T + ph}" class="forecast-origin"/>`;
  svg += `<text x="${W / 2}" y="${H - 8}" text-anchor="middle" class="curve-axis">Inicio de la semana epidemiológica</text><text transform="translate(16 ${T + ph / 2}) rotate(-90)" text-anchor="middle" class="curve-axis">Casos por semana</text>`;
  if (obs.length) svg += `<path d="${ruta(obs)}" class="curve-line curve-year-2025"/>`;
  if (pro.length) svg += `<path d="${ruta(pro)}" class="${clase}"/>`;
  if (m.tipo === 'exploratorio' && pro.length) {
    // Rótulo completo dentro de la gráfica; si es largo, en dos renglones partidos tras «no validado:».
    const [l1, l2] = m.rotulo.length > 70 && m.rotulo.includes(': ') ? [m.rotulo.slice(0, m.rotulo.indexOf(': ') + 1), m.rotulo.slice(m.rotulo.indexOf(': ') + 2)] : [m.rotulo, ''];
    svg += `<text x="${W - R}" y="${T + 14}" text-anchor="end" class="forecast-watermark" aria-label="${esc(m.rotulo)}">${esc(l1)}${l2 ? `<tspan x="${W - R}" dy="16">${esc(l2)}</tspan>` : ''}</text>`;
  }
  return `${svg}</svg>`;
}

const minuscula = (t) => String(t ?? '').charAt(0).toLowerCase() + String(t ?? '').slice(1);
const enlaceHtml = (m) => (m.enlace ? `<a href="/${esc(m.enlace.href)}">${esc(m.enlace.texto)}</a>.` : '');

function rotuloHtml(m) {
  if (m.tipo === 'exploratorio' && m.sin_pronostico) {
    return `<p class="forecast-label forecast-label--sin" role="note"><b>Sin pronóstico exploratorio.</b> ${esc(m.sin_pronostico)} Se muestra sólo la serie observada. Motivo por el que no tiene modelo: ${esc(m.motivo)} ${enlaceHtml(m)}</p>`;
  }
  if (m.tipo === 'exploratorio') {
    const ult = m.fuente_notas?.tramo?.at(-1);
    const base = m.base ? ` ${m.notas ? 'Se usa porque' : 'Respaldo usado porque'} ${esc(minuscula(m.motivo_respaldo))} Nivel: media de ${m.base.n} ${m.base.n === 1 ? 'semana' : 'semanas'} ${m.notas ? 'derivadas del acumulado' : 'con cifra impresa'}, de ${esc(m.base.periodo)}.${ult ? ` Última nota usada: boletín ${esc(ult.boletin)}, página ${ult.pagina}, «${esc(ult.frase)}» (acumulado ${esc(ult.acumulado)}); ${m.fuente_notas.tramo.length} boletines consecutivos en el tramo.` : ''}${m.base.nota ? ` ${esc(m.base.nota)}` : ''}` : '';
    return `<p class="forecast-label forecast-label--exploratorio" role="note"><b>${esc(m.rotulo)}.</b> ${esc(m.motivo)} ${esc(m.advertencia)}${base} ${enlaceHtml(m)}</p>`;
  }
  return `<p class="forecast-label" role="note"><b>${esc(m.rotulo)}.</b> ${esc(m.incertidumbre)}. ${m.etiqueta ? `Etiqueta publicada: «${esc(m.etiqueta)}».` : esc(m.detalle ?? '')} <a href="/${esc(m.pagina)}">Ver su ficha en EpiForecast</a>.</p>`;
}

function pintar(m) {
  const pro = m.pronostico.filter((p) => p.y != null);
  $('forecastTitle').textContent = `${m.nombre ?? 'Pronóstico'} · Nacional`;
  if (m.aviso) {
    $('forecastLabel').innerHTML = `<p class="forecast-label" role="note">${esc(m.aviso)}</p>`;
    $('forecastChart').innerHTML = ''; $('forecastStats').innerHTML = ''; $('forecastCaption').textContent = '';
    return;
  }
  $('forecastLabel').innerHTML = rotuloHtml(m);
  $('forecastStats').innerHTML = [
    ['Tipo', m.tipo === 'exploratorio' ? (m.sin_pronostico ? 'Sin pronóstico' : m.notas ? 'Exploratorio desde las notas, no validado' : m.nivel_reciente ? 'Exploratorio de nivel reciente, no validado' : 'Exploratorio, no validado') : 'Pronóstico publicado'],
    ['Origen', m.origen || 'Sin dato'],
    ['Semanas pronosticadas', String(pro.length)],
    ['Suma de las semanas mostradas', m.total == null ? 'Sin dato' : fmt(m.total)],
  ].map(([l, v]) => `<div><span>${l}</span><strong>${esc(v)}</strong></div>`).join('');
  $('forecastChart').innerHTML = grafica(m);
  $('forecastLegend').innerHTML = `<span class="curve-legend-2025">Observado</span>${pro.length ? `<span class="forecast-legend${m.tipo === 'exploratorio' ? ' forecast-legend--exploratorio' : ''}">${m.tipo === 'exploratorio' ? (m.notas ? 'Exploratorio desde las notas, no validado' : m.nivel_reciente ? 'Exploratorio de nivel reciente, no validado' : 'Exploratorio, no validado') : 'Pronóstico publicado'}</span>` : ''}`;
  $('forecastCaption').textContent = `Ámbito: ${m.serie_nombre}. Fuente: ${m.fuente}.${m.anios?.length ? ` Años base de la media: ${m.anios.join(', ')}.` : ''}${m.base ? ` Semanas base del nivel: ${m.base.periodo}.` : ''} Pronóstico puntual, sin intervalos en esta gráfica. Se muestran hasta ${OBSERVADO_SEMANAS} semanas observadas.${totalPublicado(m)}`;
}

/** Si el total publicado difiere de la suma de las cifras semanales mostradas, se dice por qué. */
function totalPublicado(m) {
  if (m.total_publicado == null || m.total == null || Math.abs(m.total_publicado - m.total) < 0.05) return '';
  return ` La fuente publica un total de ${fmt(m.total_publicado)} para estas 52 semanas; la suma de las cifras semanales mostradas es ${fmt(m.total)} porque cada semana se publica redondeada.`;
}

/** Vacía y oculta el resultado anterior: al cambiar de categoría o si la carga falla no queda nada de la previa. */
function limpiar() {
  $('forecastBody').hidden = true;
  $('forecastTitle').textContent = 'Pronóstico';
  for (const id of ['forecastLabel', 'forecastStats', 'forecastChart', 'forecastLegend']) $(id).innerHTML = '';
  $('forecastCaption').textContent = '';
}

async function render() {
  if (modo !== 'pronostico' || !actualId) return;
  const n = ++pedido;
  limpiar();
  $('forecastStatus').hidden = false; $('forecastStatus').textContent = 'Cargando el pronóstico…';
  try {
    await cargarBase();
    const m = await modelo(actualId);
    if (n !== pedido) return;
    pintar({ observado: [], pronostico: [], ...m });
    $('forecastBody').hidden = false;
    $('forecastStatus').hidden = true;
  } catch (e) {
    if (n === pedido) $('forecastStatus').textContent = e.message;
    console.error(e);
  }
}

function fijarModo(nuevo, { url = true } = {}) {
  modo = nuevo === 'pronostico' ? 'pronostico' : 'serie';
  for (const [tab, m] of [['tabSerie', 'serie'], ['tabPronostico', 'pronostico']]) {
    $(tab).setAttribute('aria-selected', String(modo === m)); $(tab).classList.toggle('selected', modo === m);
    $(tab).setAttribute('tabindex', modo === m ? '0' : '-1');
  }
  $('seriePanel').hidden = modo !== 'serie';
  $('forecastPanel').hidden = modo !== 'pronostico';
  $('curvas').classList.toggle('modo-pronostico', modo === 'pronostico');
  if (url) {
    const u = new URL(location.href);
    if (modo === 'pronostico') u.searchParams.set('vista', 'pronostico'); else u.searchParams.delete('vista');
    history.replaceState(null, '', u);
  }
  render();
}

actualId = new URLSearchParams(location.search).get('padecimiento') || null;
// Cambio de categoría: por el evento que curves.js emite antes de cargar la serie y, además, por el selector mismo,
// para no depender de que la carga histórica termine bien. render() descarta pedidos superados.
document.addEventListener('radar:curva', (e) => { if (e.detail.id !== actualId) { actualId = e.detail.id; render(); } });
$('curveDisease').addEventListener('change', (e) => { if (e.target.value && e.target.value !== actualId) { actualId = e.target.value; render(); } });
$('tabSerie').addEventListener('click', () => fijarModo('serie'));
$('tabPronostico').addEventListener('click', () => fijarModo('pronostico'));
// Patrón ARIA de pestañas: flechas, Inicio y Fin mueven el foco y activan la pestaña (activación automática).
function teclaPestanas(e) {
  const orden = ['serie', 'pronostico'], i = orden.indexOf(modo);
  const destino = { ArrowRight: orden[(i + 1) % 2], ArrowLeft: orden[(i + 1) % 2], Home: 'serie', End: 'pronostico' }[e.key];
  if (!destino) return;
  e.preventDefault();
  fijarModo(destino);
  $(destino === 'serie' ? 'tabSerie' : 'tabPronostico').focus();
}
$('tabSerie').addEventListener('keydown', teclaPestanas);
$('tabPronostico').addEventListener('keydown', teclaPestanas);
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-forecast]');
  if (!b) return;
  $('detail')?.close();
  const sel = $('curveDisease');
  if (sel.value !== b.dataset.forecast && [...sel.options].some((o) => o.value === b.dataset.forecast)) {
    sel.value = b.dataset.forecast; sel.dispatchEvent(new Event('change'));
  }
  actualId = b.dataset.forecast;
  fijarModo('pronostico');
  $('curvas').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});
fijarModo(new URLSearchParams(location.search).get('vista'), { url: false });
