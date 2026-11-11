// dashboard.mjs: controlador del dashboard v2 (panorama, explorar, comparar, perfil, vigilancia).
// La lógica de datos vive en data.mjs, unified.mjs y analytics.mjs; aquí sólo se orquesta y se dibuja.
// Seguridad: el DOM se construye con createElement/createElementNS y nodos de texto; ningún dato se
// interpreta como marcado. Los anchos de barras usan CSSOM (element.style), que la CSP permite.
import {
  MAP_URL, TABLEAU_ARCHIVE_URL, FASES, SEXOS, VENTANAS, METRICAS, PAGE_SIZES, ESTADOS,
  resolveTerritory, getSeries, buildRows, applyWindow, computeKpis, motorDistribution, rankEstados,
  quantileThresholds, bucketOf, niceTicks, formatInt, formatValue, formatDate, formatMonth, formatWeek,
  csvField, slugify, normName, parseState, normalizeMap, createCachedLoader, createLatest,
  filterByFase, paginate,
} from './data.mjs';
import { validateCatalog, normalizeDataset, datasetSexes, resolveDatasetSex } from './unified.mjs';
import { buildComparison, comparisonCSV, temporalProfile } from './analytics.mjs';
import { layoutSvgExport } from './svg_export.mjs';
import {
  valueUnit, scaleLabel, comparisonScaleText, comparisonUnitId, totalSourceLabel, statusText,
} from './units.mjs';

const CATALOG_URL = 'assets/dashboard/catalog.json';
const SVG_NS = 'http://www.w3.org/2000/svg';
const VISTAS = ['panorama', 'explorar', 'comparar', 'perfil', 'vigilancia'];
const TOOL_VISTAS = new Set(['explorar', 'comparar', 'perfil']);
const SERIES_VIS = ['ambas', 'observado', 'pronostico'];
const DEFAULT_P = 'depresion';
const MAX_CMP = 4;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[a-z0-9_]{1,64}$/;
const SLUG_RE = /^[a-z0-9-]{1,64}$/;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const STATUS_SHORT = {
  pass: 'Validación superada',
  pending: 'Validación en curso',
  control: 'Control estacional',
  legacy: 'Serie histórica',
};
const STATUS_ORDER = { pass: 0, pending: 1, control: 2, legacy: 3 };
const GROUPS = [
  ['legacy', 'Series históricas por entidad'],
  ['pass', 'Releases: validación prospectiva superada'],
  ['pending', 'Releases: validación prospectiva en curso'],
  ['control', 'Releases: control estacional publicado'],
];

const $ = (id) => document.getElementById(id);

// ── Constructores seguros ───────────────────────────────────────────────────
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  setAttrs(node, attrs);
  append(node, children);
  return node;
}
function sv(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  setAttrs(node, attrs);
  append(node, children);
  return node;
}
function setAttrs(node, attrs) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (/^on/i.test(k) || k === 'style') continue; // ni manejadores ni estilos en línea
    node.setAttribute(k, v === true ? '' : String(v));
  }
}
function append(node, children) {
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
const clear = (node) => node.replaceChildren();

// ── Formato propio de la UI ─────────────────────────────────────────────────
const DTF = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
});
const NF = new Intl.NumberFormat('es-MX');
function formatEmission(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : `${DTF.format(d).replace(/\./g, '')} UTC`;
}
const weekCode = (w) => (w && Number.isInteger(w.anio) && Number.isInteger(w.semana)
  ? `${w.anio}-W${String(w.semana).padStart(2, '0')}` : null);
const weekKey = (w) => (w && Number.isInteger(w.anio) && Number.isInteger(w.semana) ? w.anio * 100 + w.semana : -1);
const sexLabel = (id) => SEXOS.find((x) => x.id === id)?.label ?? id;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
function optionText(e) {
  return !e.cie || e.label.includes(e.cie) ? e.label : `${e.label} (${e.cie})`;
}
/** Sólo rutas relativas del sitio: nunca esquemas (javascript:, data:) ni hosts externos. */
function safeHref(u) {
  return typeof u === 'string' && /^(?!\/\/)[A-Za-z0-9_][A-Za-z0-9_.\/-]*$/.test(u) && !u.includes('..') ? u : null;
}
function statusKind(e) {
  return Object.hasOwn(STATUS_SHORT, e?.status?.kind) ? e.status.kind : 'legacy';
}

// ── Estado en la URL ────────────────────────────────────────────────────────
// parseState() de data.mjs sólo conoce los cuatro padecimientos históricos: aquí se usa para
// s, t, v, m y archivo; p se valida contra el catálogo publicado al cargarlo.
function readState(search) {
  const q = new URLSearchParams(search ?? '');
  const base = parseState(search);
  const pRaw = q.get('p');
  const p = pRaw && ID_RE.test(pRaw) ? pRaw : null;
  const vRaw = q.get('vista');
  const vista = VISTAS.includes(vRaw) ? vRaw : (p ? 'explorar' : 'panorama');
  const iso = (k) => { const x = q.get(k); return x && ISO_RE.test(x) ? x : null; };
  let from = iso('desde');
  let to = iso('hasta');
  if (from && to && from > to) { from = null; to = null; }
  const ser = SERIES_VIS.includes(q.get('ser')) ? q.get('ser') : 'ambas';
  const c = [...new Set((q.get('c') ?? '').split(',').filter((x) => SLUG_RE.test(x)))].slice(0, MAX_CMP);
  return {
    vista, p, s: base.s, t: base.t, v: base.v, m: base.m, from, to, ser, c,
    cm: q.get('cm') === 'indexed' ? 'indexed' : 'absolute',
    pm: q.get('pm') === 'suma' ? 'suma' : 'promedio',
    archivo: base.archivo,
  };
}

function writeState(st) {
  const q = new URLSearchParams();
  q.set('vista', st.vista);
  if (st.p) {
    q.set('p', st.p);
    q.set('s', st.s);
    q.set('t', st.t);
    q.set('v', st.v);
    q.set('m', st.m);
  }
  if (st.from) q.set('desde', st.from);
  if (st.to) q.set('hasta', st.to);
  if (st.ser !== 'ambas') q.set('ser', st.ser);
  if (st.c.length) q.set('c', st.c.join(','));
  if (st.cm !== 'absolute') q.set('cm', st.cm);
  if (st.pm !== 'promedio') q.set('pm', st.pm);
  if (st.archivo) q.set('archivo', 'tableau');
  return `?${q.toString()}`;
}

// ── Estado de la aplicación ─────────────────────────────────────────────────
const load = createCachedLoader((url, init) => fetch(url, init));
const latest = createLatest();
let state = readState(location.search);
let catalog = null;
let catalogById = new Map();
let catalogPromise = null;
const datasetCache = new Map(); // entry.id → promesa del conjunto normalizado (olvida fallos)
let sel = null; // selección vigente; null mientras carga o tras un fallo
let cursor = null;
let cursorDate = null;
let cmpCursor = null;
let mapModel = null;
let mapReady = null;
let archiveActive = false;
let survPromise = null;
let survReady = false;
const table = { fase: 'todas', page: 1, size: PAGE_SIZES[0] };
const cmpTable = { page: 1, size: PAGE_SIZES[0] };
const pano = { q: '', estado: 'todos', orden: 'nombre', modo: 'tarjetas' };

// ── Arranque ────────────────────────────────────────────────────────────────
function init() {
  bindTabs();
  bindPanorama();
  bindSelection();
  bindExplore();
  bindCompare();
  bindProfile();
  setupArchive();
  $('catalogo-reintentar').addEventListener('click', () => start());
  $('vig-reintentar').addEventListener('click', () => ensureSurveillance());
  window.addEventListener('popstate', () => {
    state = readState(location.search);
    if (!state.archivo) leaveArchive();
    route();
  });
  let resizeTimer = 0;
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (Math.abs(window.innerWidth - lastWidth) < 24) return;
      lastWidth = window.innerWidth;
      if (!sel) return;
      if (state.vista === 'explorar' && sel.rows) renderChart();
      if (state.vista === 'comparar' && sel.cmp) renderCompareChart();
    }, 150);
  });
  showTab(state.vista);
  earlyRoute();
  start();
}

async function start() {
  $('catalogo-error').hidden = true;
  $('catalogo-cargando').hidden = false;
  try {
    await ensureCatalog();
  } catch (err) {
    $('catalogo-cargando').hidden = true;
    $('catalogo-error').hidden = false;
    $('catalogo-error-msg').textContent = `No se pudo cargar el catálogo de padecimientos publicados (${err.message}). Reintenta en unos momentos.`;
    for (const id of ['em-padecimientos', 'em-series']) $(id).textContent = 'sin dato';
    return;
  }
  $('catalogo-cargando').hidden = true;
  route();
}

// La vigilancia se puede abrir aunque el catálogo aún no esté listo.
function earlyRoute() {
  if (state.vista === 'vigilancia') route();
}

function ensureCatalog() {
  if (catalog) return Promise.resolve(catalog);
  if (!catalogPromise) {
    catalogPromise = load(CATALOG_URL).then((json) => {
      const valid = validateCatalog(json); // lanza si el esquema o las entradas no son válidos
      if (!Array.isArray(valid?.diseases) || !valid.diseases.length) throw new Error('catálogo vacío');
      catalog = valid;
      catalogById = new Map(valid.diseases.map((d) => [d.id, d]));
      onCatalogReady();
      return valid;
    });
    catalogPromise.catch(() => { catalogPromise = null; });
  }
  return catalogPromise;
}

function onCatalogReady() {
  const s = catalog.summary ?? {};
  const nDis = isNum(s.diseases) ? s.diseases : catalog.diseases.length;
  const nSeries = isNum(s.series) ? s.series : catalog.diseases.reduce((a, d) => a + (isNum(d.nSeries) ? d.nSeries : 0), 0);
  $('em-padecimientos').textContent = `${NF.format(nDis)} (${NF.format(s.legacy ?? countKind('legacy'))} históricos, ${NF.format(s.release ?? countKind('release'))} releases)`;
  $('em-series').textContent = NF.format(nSeries);
  populateDiseaseSelect();
  renderPanoramaSummary(nDis, nSeries);
  $('pano').hidden = false;
  renderPanorama();
}
const countKind = (k) => catalog.diseases.filter((d) => d.kind === k).length;

// ── Enrutado entre herramientas ─────────────────────────────────────────────
function update(patch, { push = true } = {}) {
  const prev = state;
  state = { ...state, ...patch };
  if (push) history.pushState(null, '', writeState(state));
  else replaceUrl();
  if (patch.vista && patch.vista !== prev.vista) archiveActive = false;
  route(prev);
}

function replaceUrl() {
  const next = writeState(state);
  if (location.search !== next) history.replaceState(null, '', next);
}

function announce(msg) { $('estado').textContent = msg; }

function route(prev = null) {
  showTab(archiveActive ? 'archivo' : state.vista);
  const vista = state.vista;
  const tool = !archiveActive && TOOL_VISTAS.has(vista) && Boolean(catalog);
  $('barra-seleccion').hidden = !tool;
  $('herramienta-estado').hidden = !tool;
  if (archiveActive) return;
  if (vista === 'vigilancia') { ensureSurveillance(); return; } // no depende del catálogo
  if (!catalog) return;
  if (vista === 'panorama') { syncPanoramaControls(); return; }
  if (!state.p) state.p = catalogById.has(DEFAULT_P) ? DEFAULT_P : catalog.diseases[0].id;
  const needsLoad = !sel || sel.entry.id !== state.p || sel.slug !== state.t || sel.sex !== state.s;
  if (needsLoad) {
    // Un fallo previo de la misma selección no se reintenta solo al cambiar de herramienta.
    if (prev && !sel && !$('error').hidden && prev.p === state.p && prev.t === state.t && prev.s === state.s) return;
    loadSelection();
    return;
  }
  syncSelectionControls();
  renderActiveTool();
}

function renderActiveTool() {
  if (!sel) return;
  if (state.vista === 'explorar') renderExplore();
  else if (state.vista === 'comparar') renderCompare();
  else if (state.vista === 'perfil') renderProfile();
}

// ── Pestañas ────────────────────────────────────────────────────────────────
function tabButtons() {
  return [...$('tabs').querySelectorAll('[role=tab]')].filter((t) => !t.hidden);
}

function showTab(name) {
  for (const tab of $('tabs').querySelectorAll('[role=tab]')) {
    const id = tab.id.replace('tab-', '');
    const on = id === name;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    const panel = $(tab.getAttribute('aria-controls'));
    if (panel) panel.hidden = !on;
  }
}

function bindTabs() {
  const tabs = $('tabs');
  tabs.addEventListener('click', (ev) => {
    const tab = ev.target.closest('[role=tab]');
    if (!tab) return;
    if (tab.id === 'tab-archivo') { enterArchive(); return; }
    const vista = tab.dataset.vista;
    if (archiveActive) { archiveActive = false; }
    if (vista === state.vista) { route(); return; }
    update({ vista });
  });
  tabs.addEventListener('keydown', (ev) => {
    const list = tabButtons();
    const i = list.indexOf(document.activeElement);
    if (i < 0) return;
    let j = null;
    if (ev.key === 'ArrowRight') j = (i + 1) % list.length;
    else if (ev.key === 'ArrowLeft') j = (i - 1 + list.length) % list.length;
    else if (ev.key === 'Home') j = 0;
    else if (ev.key === 'End') j = list.length - 1;
    if (j === null) return;
    ev.preventDefault();
    const tab = list[j];
    tab.focus();
    // Recorrer pestañas con flechas no llena el historial: replaceState. El clic normal sigue con pushState.
    if (tab.id === 'tab-archivo') { enterArchive(); return; }
    archiveActive = false;
    if (tab.dataset.vista === state.vista) { route(); return; }
    update({ vista: tab.dataset.vista }, { push: false });
  });
}

// ── Panorama ────────────────────────────────────────────────────────────────
function bindPanorama() {
  $('pano-filtros').addEventListener('submit', (ev) => ev.preventDefault());
  $('pano-buscar').addEventListener('input', (ev) => { pano.q = ev.target.value; renderPanorama(); });
  $('pano-estado').addEventListener('change', (ev) => { pano.estado = ev.target.value; renderPanorama(); });
  $('pano-orden').addEventListener('change', (ev) => { pano.orden = ev.target.value; renderPanorama(); });
  $('pano-filtros').addEventListener('change', (ev) => {
    if (ev.target.name !== 'pano-modo') return;
    pano.modo = ev.target.value;
    renderPanorama();
  });
}

function syncPanoramaControls() {
  $('pano-buscar').value = pano.q;
  $('pano-estado').value = pano.estado;
  $('pano-orden').value = pano.orden;
}

function renderPanoramaSummary(nDis, nSeries) {
  const list = $('pano-resumen');
  clear(list);
  const counts = { pass: 0, pending: 0, control: 0, legacy: 0 };
  for (const d of catalog.diseases) counts[statusKind(d)] += 1;
  const items = [
    [NF.format(nDis), 'padecimientos'],
    [NF.format(nSeries), 'series publicadas'],
    [NF.format(counts.pass), 'con validación superada'],
    [NF.format(counts.pending), 'en validación'],
    [NF.format(counts.control), 'controles estacionales'],
    [NF.format(counts.legacy), 'series históricas'],
  ];
  for (const [n, label] of items) list.append(el('li', {}, el('strong', {}, n), ` ${label}`));
}

function panoramaList() {
  const q = normName(pano.q);
  let list = catalog.diseases.filter((d) => {
    if (pano.estado !== 'todos' && statusKind(d) !== pano.estado) return false;
    if (!q) return true;
    return [d.label, d.labelShort, d.cie, d.id].some((x) => x && normName(x).includes(q));
  });
  const byName = (a, b) => a.label.localeCompare(b.label, 'es');
  const sorters = {
    nombre: byName,
    cie: (a, b) => String(a.cie ?? '~').localeCompare(String(b.cie ?? '~'), 'es') || byName(a, b),
    estado: (a, b) => (STATUS_ORDER[statusKind(a)] - STATUS_ORDER[statusKind(b)]) || byName(a, b),
    origen: (a, b) => (weekKey(b.origin) - weekKey(a.origin)) || byName(a, b),
    observacion: (a, b) => (weekKey(b.lastObservation) - weekKey(a.lastObservation)) || byName(a, b),
  };
  list = [...list].sort(sorters[pano.orden] ?? byName);
  return list;
}

function renderPanorama() {
  if (!catalog) return;
  const list = panoramaList();
  const total = catalog.diseases.length;
  $('pano-conteo').textContent = list.length === total
    ? `Mostrando los ${total} padecimientos publicados.`
    : `Mostrando ${list.length} de ${total} padecimientos.`;
  const cardsMode = pano.modo === 'tarjetas';
  $('pano-tarjetas').hidden = !cardsMode;
  $('pano-tabla-wrap').hidden = cardsMode;
  if (cardsMode) {
    const frag = document.createDocumentFragment();
    for (const d of list) frag.append(panoramaCard(d));
    if (!list.length) frag.append(el('li', { class: 'empty-inline' }, 'Ningún padecimiento coincide con la búsqueda y el filtro.'));
    $('pano-tarjetas').replaceChildren(frag);
  } else {
    const frag = document.createDocumentFragment();
    for (const d of list) frag.append(panoramaRow(d));
    if (!list.length) frag.append(el('tr', { class: 'empty-row' }, el('td', { colspan: '9' }, 'Ningún padecimiento coincide con la búsqueda y el filtro.')));
    $('pano-tabla-cuerpo').replaceChildren(frag);
  }
}

function nationalSummary(d) {
  const nat = d.national ?? {};
  const sex = nat.general ? 'general' : SEXOS.map((s) => s.id).find((s) => nat[s]);
  return sex ? { sex, ...nat[sex] } : null;
}

function statusBadge(d) {
  const k = statusKind(d);
  return el('span', { class: `badge badge--${k}` }, STATUS_SHORT[k]);
}

function weeksText(st) {
  return isNum(st?.weeksAvailable) && isNum(st?.weeksRequired) ? `${st.weeksAvailable}/${st.weeksRequired} semanas` : null;
}
/** Etiqueta oficial de publicación sin repetir «N/M semanas» si ya lo incluye. */
function statusLine(st) {
  return statusText(st?.label, st?.weeksAvailable, st?.weeksRequired);
}

function panoramaCard(d) {
  const nat = nationalSummary(d);
  const k = statusKind(d);
  const meta = el('dl', { class: 'pcard__meta' });
  const row = (dt, dd) => meta.append(el('div', {}, el('dt', {}, dt), el('dd', {}, dd)));
  row('Semana de origen', formatWeek(d.origin));
  row('Última semana observada', formatWeek(d.lastObservation));
  row('Emisión registrada', formatEmission(d.emittedAt) ?? 'no declarada en la fuente');
  row('Series', `${NF.format(d.nSeries ?? 0)} · ${(d.sexes ?? []).map(sexLabel).join(', ') || 'sin sexos'}`);

  const go = (vista) => () => openDisease(d.id, vista);
  const explore = el('button', { type: 'button', class: 'btn btn--sm' }, 'Explorar series');
  explore.addEventListener('click', go('explorar'));
  const compare = el('button', { type: 'button', class: 'btn btn--quiet btn--sm' }, 'Comparar');
  compare.addEventListener('click', go('comparar'));
  const profile = el('button', { type: 'button', class: 'btn btn--quiet btn--sm' }, 'Perfil');
  profile.addEventListener('click', go('perfil'));
  const name = d.labelShort || d.label;

  return el('li', { class: `pcard pcard--${k}` },
    el('div', { class: 'pcard__top' },
      statusBadge(d),
      d.cie ? el('span', { class: 'pcard__cie' }, d.cie) : null),
    el('h3', { class: 'pcard__title' }, d.label),
    el('p', { class: 'pcard__status' }, statusLine(d.status) || STATUS_SHORT[k]),
    sparkline(d, nat),
    nat ? forecastLine(d, nat) : el('p', { class: 'pcard__fc' }, 'Sin serie nacional en el catálogo.'),
    meta,
    el('div', { class: 'pcard__actions', role: 'group', 'aria-label': `Acciones para ${name}` },
      explore, compare, profile,
      safeHref(d.page) ? el('a', { class: 'pcard__link', href: safeHref(d.page) }, 'Página del padecimiento') : null));
}

function forecastLine(d, nat) {
  const source = nat.forecastTotalSource
    ? totalSourceLabel(nat.forecastTotalSource)
    : (d.kind === 'legacy' ? totalSourceLabel('suma_json_visual_redondeado') : totalSourceLabel(null));
  const unit = valueUnit(d.kind, nat.sex);
  const span = nat.start && nat.end ? `, índice del ${formatDate(nat.start)} al ${formatDate(nat.end)}` : '';
  return el('p', { class: 'pcard__fc' },
    `Pronóstico nacional ${sexLabel(nat.sex).toLowerCase()}: `,
    el('strong', {}, isNum(nat.forecastTotal) ? `${formatInt(nat.forecastTotal)} ${unit.short}` : 'sin dato'),
    ` en ${NF.format(nat.forecastN ?? 0)} semanas${span} (${source}).`);
}

function sparkline(d, nat) {
  const pts = Array.isArray(nat?.spark) ? nat.spark.filter((p) => Array.isArray(p) && ISO_RE.test(p[0])) : [];
  const vals = pts.map((p) => p[1]).filter(isNum);
  if (!vals.length) return el('p', { class: 'pcard__spark pcard__spark--empty' }, 'Sin observaciones recientes en el catálogo.');
  const W = 240, H = 46, P = 3;
  const lo = Math.min(0, ...vals), hi = Math.max(...vals);
  const x = (i) => P + (pts.length === 1 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (pts.length - 1));
  const y = (v) => H - P - ((v - lo) / (hi - lo || 1)) * (H - 2 * P);
  let dPath = '', pen = false;
  pts.forEach((p, i) => {
    if (!isNum(p[1])) { pen = false; return; }
    dPath += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`;
    pen = true;
  });
  const first = pts[0][0], last = pts[pts.length - 1][0];
  const label = `Observado nacional ${sexLabel(nat.sex).toLowerCase()} en las últimas ${pts.length} fechas del índice, del ${formatDate(first)} al ${formatDate(last)}: mínimo ${formatValue(Math.min(...vals))}, máximo ${formatValue(Math.max(...vals))}, último ${formatValue(pts[pts.length - 1][1])}.`;
  return el('figure', { class: 'pcard__spark' },
    sv('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label, preserveAspectRatio: 'none' },
      sv('line', { class: 'spark-base', x1: P, x2: W - P, y1: y(0), y2: y(0) }),
      sv('path', { class: 'spark-line', d: dPath })),
    el('figcaption', {}, `Observado nacional, ${formatMonth(first)} a ${formatMonth(last)}`));
}

function panoramaRow(d) {
  const btn = el('button', { type: 'button', class: 'btn btn--quiet btn--sm' }, 'Explorar');
  btn.addEventListener('click', () => openDisease(d.id, 'explorar'));
  return el('tr', {},
    el('th', { scope: 'row' }, safeHref(d.page) ? el('a', { href: safeHref(d.page) }, d.label) : d.label),
    el('td', {}, d.cie ?? 'sin dato'),
    el('td', { class: 'wrap-cell' }, statusBadge(d), ' ', statusLine(d.status)),
    el('td', {}, formatWeek(d.origin)),
    el('td', {}, formatWeek(d.lastObservation)),
    el('td', {}, formatEmission(d.emittedAt) ?? 'no declarada'),
    el('td', { class: 'num' }, NF.format(d.nSeries ?? 0)),
    el('td', {}, (d.sexes ?? []).map(sexLabel).join(', ')),
    el('td', {}, btn));
}

function openDisease(id, vista) {
  const patch = { vista, p: id };
  if (id !== state.p) Object.assign(patch, { c: [], from: null, to: null });
  update(patch);
  $(`panel-${vista}`)?.focus({ preventScroll: false });
}

// ── Selección compartida ────────────────────────────────────────────────────
function populateDiseaseSelect() {
  const select = $('f-padecimiento');
  const frag = document.createDocumentFragment();
  for (const [kind, label] of GROUPS) {
    const items = catalog.diseases.filter((d) => statusKind(d) === kind)
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
    if (!items.length) continue;
    const group = el('optgroup', { label: `${label} (${items.length})` });
    for (const d of items) group.append(el('option', { value: d.id }, optionText(d)));
    frag.append(group);
  }
  select.replaceChildren(frag);
  select.disabled = false;
  if (state.p && catalogById.has(state.p)) select.value = state.p;
}

function bindSelection() {
  $('filtros').addEventListener('submit', (ev) => ev.preventDefault());
  $('filtros').addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.name === 'p') update({ p: t.value, c: [], from: null, to: null });
    else if (t.name === 's') update({ s: t.value });
    else if (t.name === 't') update({ t: t.value });
  });
  $('reintentar').addEventListener('click', () => loadSelection());
  $('copiar-enlace').addEventListener('click', copyLink);
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(location.href);
    announce('Enlace de la selección copiado.');
  } catch {
    announce('No se pudo copiar; el enlace de la barra de direcciones conserva la selección.');
  }
}

function syncSelectionControls() {
  if (state.p && catalogById.has(state.p)) $('f-padecimiento').value = state.p;
  for (const input of $('f-sexo').querySelectorAll('input')) input.checked = input.value === state.s;
  const terr = $('f-territorio');
  if ([...terr.options].some((o) => o.value === state.t)) terr.value = state.t;
}

/** Sólo sexos existentes para el territorio: los demás quedan deshabilitados y rotulados. */
function syncSexControls(dataset, slug) {
  const avail = new Set(dataset ? datasetSexes(dataset, slug) : SEXOS.map((s) => s.id));
  for (const input of $('f-sexo').querySelectorAll('input')) {
    const ok = avail.has(input.value);
    input.disabled = !ok;
    input.checked = input.value === state.s;
    const span = input.nextElementSibling;
    span.textContent = sexLabel(input.value);
    if (!ok) span.append(el('span', { class: 'sr-only' }, ' (sin serie publicada)'));
    input.closest('label').classList.toggle('is-off', !ok);
    input.closest('label').title = ok ? '' : 'Sin serie publicada para este territorio';
  }
}

function populateTerritories(index) {
  const select = $('f-territorio');
  const groups = { estado: el('optgroup', { label: 'Entidades federativas' }), region: el('optgroup', { label: 'Regiones' }) };
  const frag = document.createDocumentFragment();
  for (const e of index.entities.values()) {
    const opt = el('option', { value: e.slug }, e.label);
    if (e.tipo === 'nacional') frag.append(opt);
    else groups[e.tipo]?.append(opt);
  }
  if (groups.estado.children.length) frag.append(groups.estado);
  if (groups.region.children.length) frag.append(groups.region);
  select.replaceChildren(frag);
  select.value = state.t;
  select.disabled = false;
}

function setToolPhase(phase, message = '') {
  const ready = phase === 'ready';
  for (const id of ['dash', 'cmp-body', 'prof-body']) $(id).hidden = !ready;
  $('cargando').hidden = phase !== 'loading';
  $('error').hidden = phase !== 'error';
  if (phase === 'loading') $('cargando-msg').textContent = message;
  if (phase === 'error') $('error-msg').textContent = message;
  if (!ready) {
    sel = null;
    $('aviso').hidden = true;
    $('descargar-csv').disabled = true;
  }
}

function getDataset(entry) {
  if (!datasetCache.has(entry.id)) {
    const url = safeHref(entry.url);
    const p = (url ? load(url) : Promise.reject(new Error('ruta de fuente no válida'))).then((payload) => {
      const ds = normalizeDataset(entry, payload);
      if (!ds?.index?.entities?.size) throw new Error('la fuente no contiene series utilizables');
      return ds;
    });
    datasetCache.set(entry.id, p);
    p.catch(() => { if (datasetCache.get(entry.id) === p) datasetCache.delete(entry.id); });
  }
  return datasetCache.get(entry.id);
}

async function loadSelection() {
  const token = latest.next();
  const notices = [];
  let entry = catalogById.get(state.p);
  if (!entry) {
    const fb = catalogById.get(DEFAULT_P) ?? catalog.diseases[0];
    notices.push(`El padecimiento solicitado («${state.p}») no está en el catálogo publicado; se muestra ${fb.label}.`);
    entry = fb;
    state.p = fb.id;
    state.c = [];
  }
  $('f-padecimiento').value = entry.id;
  setToolPhase('loading', `Cargando las series de ${entry.label}…`);
  announce(`Cargando ${entry.label}…`);

  let ds;
  try {
    ds = await getDataset(entry);
  } catch (err) {
    if (!latest.isCurrent(token)) return;
    setToolPhase('error', `No se pudieron cargar las series de ${entry.label} (${err.message}). Revisa tu conexión y reintenta, o elige otro padecimiento.`);
    announce('');
    return;
  }
  if (!latest.isCurrent(token)) return; // otra selección ganó la carrera

  const { t, fallback: tFb } = resolveTerritory(ds.index, state.t);
  if (!t) {
    setToolPhase('error', `La fuente de ${entry.label} no contiene territorios utilizables.`);
    return;
  }
  const entity = ds.index.entities.get(t);
  if (tFb) notices.push(`${entry.labelShort || entry.label} no publica serie para el territorio solicitado («${state.t}»); se muestra ${entity.label}.`);
  const requestedSex = state.s;
  const { sex, fallback: sFb } = resolveDatasetSex(ds, t, requestedSex) ?? {};
  state = { ...state, p: entry.id, t };
  populateTerritories(ds.index);
  if (!sex) {
    syncSexControls(ds, t);
    const avail = datasetSexes(ds, t).map(sexLabel);
    setToolPhase('error', `${entity.label} no publica la serie ${sexLabel(requestedSex)} de ${entry.label}. ${avail.length ? `Sexos disponibles: ${avail.join(', ')}. Elige uno en la barra de selección.` : 'No hay sexos publicados para este territorio.'}`);
    replaceUrl();
    return;
  }
  if (sFb) notices.push(`${entity.label} no publica la serie ${sexLabel(requestedSex)}; se muestra ${sexLabel(sex)}.`);
  state.s = sex;
  state.c = state.c.filter((slug) => ds.index.entities.has(slug) && datasetSexes(ds, slug).includes(sex));
  replaceUrl();
  syncSexControls(ds, t);
  syncSelectionControls();

  const series = getSeries(ds.raw, ds.index, t, sex);
  if (!series) {
    setToolPhase('error', `La serie ${entry.label} · ${entity.label} · ${sexLabel(sex)} no tiene fechas válidas en la fuente publicada.`);
    return;
  }
  sel = { token, entry, dataset: ds, raw: ds.raw, index: ds.index, metadata: ds.metadata ?? {}, slug: t, entity, sex, series };
  cursorDate = null;
  cmpCursor = null;
  table.page = 1;
  cmpTable.page = 1;
  setToolPhase('ready');
  const aviso = $('aviso');
  aviso.hidden = !notices.length;
  aviso.replaceChildren(...notices.map((n) => el('p', {}, n)));
  document.title = `${entry.labelShort || entry.label} · ${entity.label} · ${sexLabel(sex)} · Dashboard epidemiológico · EpiForecast-MX`;
  renderActiveTool();
  announce(notices.length ? notices.join(' ') : `${entry.labelShort || entry.label} · ${entity.label} · ${sexLabel(sex)}: listo.`);
}

function selectTerritory(slug) {
  if (slug === state.t) return;
  update({ t: slug });
}

// ── Explorar ────────────────────────────────────────────────────────────────
function bindExplore() {
  $('f-ventana').addEventListener('change', (ev) => update({ v: ev.target.value }));
  $('f-metrica').addEventListener('change', (ev) => {
    state = { ...state, m: ev.target.value };
    history.pushState(null, '', writeState(state));
    if (sel) { renderRanking(); renderMap(sel.token); }
  });
  const onDate = () => {
    const from = $('f-desde').value || null;
    const to = $('f-hasta').value || null;
    if ((from && !ISO_RE.test(from)) || (to && !ISO_RE.test(to))) return;
    if (from && to && from > to) {
      $('rango-nota').textContent = 'La fecha inicial es posterior a la final; corrige el rango para aplicarlo.';
      announce('Rango inválido: la fecha inicial es posterior a la final.');
      return;
    }
    update({ from, to });
  };
  $('f-desde').addEventListener('change', onDate);
  $('f-hasta').addEventListener('change', onDate);
  $('limpiar-rango').addEventListener('click', () => update({ from: null, to: null }));
  const onVis = (ev) => {
    const obs = $('ver-observado').checked;
    const pron = $('ver-pronostico').checked;
    if (!obs && !pron) {
      ev.target.checked = true;
      announce('El gráfico necesita al menos una serie visible.');
      return;
    }
    update({ ser: obs && pron ? 'ambas' : obs ? 'observado' : 'pronostico' }, { push: false });
  };
  $('ver-observado').addEventListener('change', onVis);
  $('ver-pronostico').addEventListener('change', onVis);
  $('descargar-csv').addEventListener('click', downloadExploreCsv);
  $('descargar-svg').addEventListener('click', downloadExploreSvg);
  $('imprimir').addEventListener('click', () => window.print());
  $('f-fase').addEventListener('change', (ev) => { table.fase = ev.target.value; table.page = 1; renderTable(); });
  $('f-filas').addEventListener('change', (ev) => { table.size = Number(ev.target.value); table.page = 1; renderTable(); });
  const go = (fn) => (ev) => {
    if (!sel?.rows) return;
    table.page = fn(table.page);
    renderTable(ev.currentTarget);
  };
  $('pag-primera').addEventListener('click', go(() => 1));
  $('pag-anterior').addEventListener('click', go((p) => p - 1));
  $('pag-siguiente').addEventListener('click', go((p) => p + 1));
  $('pag-ultima').addEventListener('click', go(() => Infinity));
  bindChart();
}

const inRange = (date) => (!state.from || date >= state.from) && (!state.to || date <= state.to);

function renderExplore() {
  const { series } = sel;
  const allRows = buildRows(series);
  const windowRows = applyWindow(allRows, state.v, series);
  const rows = windowRows.filter((r) => inRange(r.date));
  Object.assign(sel, { allRows, windowRows, rows, kpis: computeKpis(series, allRows, rows) });
  renderSelectionHead();
  renderRangeControls();
  renderKpis();
  renderChart();
  renderFicha();
  renderMotores();
  renderRanking();
  renderMap(sel.token);
  renderTable();
}

function renderSelectionHead() {
  const { entry, entity, sex } = sel;
  $('sel-eyebrow').textContent = entry.kind === 'legacy' ? 'Serie histórica por entidad' : 'Release publicado';
  $('sel-titulo').textContent = `${entry.labelShort || entry.label} · ${entity.label} · ${sexLabel(sex)}`;
  $('sel-estado').replaceChildren(statusBadge(entry), ' ',
    statusLine(entry.status));
  $('enlace-metodologia').setAttribute('href', safeHref(entry.page) ?? 'Reports/index.html');
}

function renderRangeControls() {
  $('f-ventana').value = state.v;
  const first = sel.allRows[0]?.date ?? '';
  const last = sel.allRows[sel.allRows.length - 1]?.date ?? '';
  for (const id of ['f-desde', 'f-hasta']) {
    $(id).min = first;
    $(id).max = last;
  }
  $('f-desde').value = state.from ?? '';
  $('f-hasta').value = state.to ?? '';
  $('limpiar-rango').disabled = !state.from && !state.to;
  $('ver-observado').checked = state.ser !== 'pronostico';
  $('ver-pronostico').checked = state.ser !== 'observado';
  const w = VENTANAS.find((v) => v.id === state.v);
  const range = state.from || state.to
    ? `Rango fijado: ${state.from ? formatDate(state.from) : 'inicio'} a ${state.to ? formatDate(state.to) : 'fin'} (fechas del índice).`
    : 'Sin rango adicional.';
  $('rango-nota').textContent = `${w.label}. ${range} La serie disponible va del ${formatDate(first)} al ${formatDate(last)}. ` +
    'Ocultar una serie sólo cambia el dibujo: los totales de emisión no dependen del rango ni de la visibilidad.';
}

function kpiCard({ tone, label, value, unit, lines }) {
  return el('article', { class: `kpi kpi--${tone}` },
    el('h3', { class: 'kpi__label' }, label),
    el('p', { class: 'kpi__value' }, value, unit ? el('span', { class: 'kpi__unit' }, unit) : null),
    ...lines.filter(Boolean).map((l) => (l instanceof Node ? l : el('p', { class: 'kpi__sub' }, l))));
}

function spanText(s) {
  return s.first ? `índice del ${formatDate(s.first)} al ${formatDate(s.last)}` : 'sin semanas';
}

function negativeNote(n) {
  if (!n) return null;
  const netos = sel.entry.kind === 'legacy' && sel.sex !== 'general';
  const text = netos
    ? `${n} ${n === 1 ? 'semana con incremento neto negativo' : 'semanas con incremento neto negativo'} (revisión del acumulado); sin recortar.`
    : `${n} ${n === 1 ? 'semana con valor negativo' : 'semanas con valor negativo'} en la fuente; se muestra sin recortar.`;
  return el('p', { class: 'kpi__sub kpi__sub--rev' }, text);
}

function sumNote() {
  return sel.entry.kind === 'legacy'
    ? 'Suma de los valores semanales redondeados de la serie visual; puede diferir del resumen productivo.'
    : 'Suma de los valores publicados en la vista, sin redondeo previo.';
}

function renderKpis() {
  const { kpis: k, series, entry, slug, sex } = sel;
  const box = $('kpis');
  clear(box);
  const p = k.pronostico;
  const u = valueUnit(entry.kind, sex);
  const nat = slug === 'nacional' ? entry.national?.[sex] : null;
  const canon = nat?.forecastTotal;
  box.append(kpiCard({
    tone: 'blue',
    label: 'Total emitido tras el corte',
    value: formatInt(p.sum),
    unit: u.short,
    lines: [
      `${p.n} pasos semanales con valor, ${spanText(p)}. Emisión completa: no cambia con la ventana, el rango ni la visibilidad.`,
      p.nNull ? `${p.nNull} semanas sin dato.` : null,
      sumNote(),
      isNum(canon) && Math.round(canon) !== Math.round(p.sum ?? NaN)
        ? `Total del catálogo (${totalSourceLabel(nat.forecastTotalSource)}): ${formatInt(canon)} ${u.short}.` : null,
    ],
  }));

  const o = k.observadoVentana;
  box.append(kpiCard({
    tone: 'green',
    label: u.net ? 'Incremento neto observado en ventana y rango' : 'Observado en ventana y rango',
    value: formatInt(o.sum),
    unit: u.short,
    lines: [
      `${o.n} semanas con dato, ${spanText(o)}.`,
      o.nNull ? `${o.nNull} semanas sin dato (no se cuentan como cero).` : null,
      negativeNote(o.negatives),
      u.note,
    ],
  }));

  const c = k.contraste;
  box.append(kpiCard({
    tone: 'ink',
    label: 'Después del corte, ya observado',
    value: c.pares ? `${formatInt(c.real)} / ${formatInt(c.pron)}` : 'sin semanas',
    unit: c.pares ? 'obs. / pron.' : null,
    lines: [
      c.weeks
        ? `${c.pares} de ${c.weeks} semanas con ambos valores; índice del ${formatDate(c.first)} al ${formatDate(c.last)}.`
        : `El último índice observado (${formatDate(series.lastReal)}) no rebasa la frontera del corte.`,
      'Comparación descriptiva; no es una medida de precisión.',
    ],
  }));

  const f = k.pendiente;
  box.append(kpiCard({
    tone: 'gold',
    label: 'Pronóstico aún no observado',
    value: formatInt(f.sum),
    unit: u.short,
    lines: [`${f.n} semanas posteriores a la última observación, ${spanText(f)}.`],
  }));
}

// ── Gráfico principal ───────────────────────────────────────────────────────
const G = { w: 960, h: 360, l: 58, r: 18, t: 34, b: 36, fs: 11, k: 1 };

/** El viewBox se escala con el ancho; compensamos tipografía y márgenes para pantallas angostas. */
function fitGeometry(svg, tickLabels, geom = G, base = 360) {
  const width = svg.getBoundingClientRect().width || geom.w;
  geom.h = width < 500 ? Math.round(base * 1.65) : base;
  svg.setAttribute('viewBox', `0 0 ${geom.w} ${geom.h}`);
  geom.k = Math.min(2.6, Math.max(1, geom.w / width));
  geom.fs = 11 * geom.k;
  geom.wide = geom.k <= 1.35;
  geom.t = geom.wide ? 22 + 12 * geom.k : 12;
  geom.b = 18 + 16 * geom.k;
  const longest = Math.max(1, ...tickLabels.map((s) => s.length));
  geom.l = 14 + longest * geom.fs * 0.6;
}

function monthTicks(group, dates, x, geom, iw, ih) {
  const n = dates.length;
  const labelW = geom.fs * 3.8;
  const stepPx = n > 1 ? iw / (n - 1) : iw;
  const minGap = Math.max(1, Math.ceil((labelW + 10 * geom.k) / stepPx));
  let lastLabeled = -Infinity;
  dates.forEach((date, i) => {
    const monthStart = i === 0 || date.slice(0, 7) !== dates[i - 1].slice(0, 7);
    if (!monthStart || i - lastLabeled < minGap) return;
    if (x(i) + labelW / 2 > geom.w || x(i) - labelW / 2 < geom.l - labelW * 0.6) return;
    lastLabeled = i;
    group.append(sv('line', { class: 'xtick', x1: x(i), x2: x(i), y1: geom.t + ih, y2: geom.t + ih + 4 }));
    group.append(sv('text', { x: x(i), y: geom.t + ih + 8 + geom.fs, class: 'tick', 'font-size': geom.fs, 'text-anchor': 'middle' }, formatMonth(date)));
  });
}

function renderChart() {
  const svg = $('grafico');
  clear(svg);
  $('graf-vacio').hidden = true;
  const rows = sel.rows;
  const { series } = sel;
  const chart = $('chart');
  const showObs = state.ser !== 'pronostico';
  const showPron = state.ser !== 'observado';

  const marks = $('graf-marcas');
  clear(marks);
  if (series.dsCorte) marks.append(el('span', { class: 'mk-key' }, `Frontera del corte en el índice: ${formatDate(series.dsCorte)}`));
  if (series.lastReal) marks.append(el('span', { class: 'mk-key mk-key--real' }, `Último índice observado: ${formatDate(series.lastReal)}`));
  if (!showObs || !showPron) marks.append(el('span', { class: 'mk-note' }, showObs ? 'Pronóstico oculto' : 'Observado oculto'));
  const unit = valueUnit(sel.entry.kind, sel.sex);
  marks.append(el('span', { class: 'mk-unit' }, `Unidad: ${unit.label}${unit.net ? ' (no son casos nuevos; pueden incluir revisiones)' : ''}.`));

  if (!rows.length) {
    $('graf-vacio').hidden = false;
    $('graf-vacio').textContent = 'La ventana y el rango elegidos no contienen semanas.';
    chart.setAttribute('aria-valuemax', '1');
    chart.setAttribute('aria-valuetext', 'Sin datos');
    clear($('readout'));
    sel.geom = null;
    return;
  }

  const values = rows.flatMap((r) => [showObs ? r.real : null, showPron ? r.pron : null]).filter((v) => v !== null);
  const lo = values.length ? Math.min(0, ...values) : 0;
  const hi = values.length ? Math.max(...values) : 1;
  const ticks = niceTicks(lo, hi, 5);
  fitGeometry(svg, ticks.map(formatValue));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const iw = G.w - G.l - G.r, ih = G.h - G.t - G.b;
  const n = rows.length;
  const x = (i) => G.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v) => G.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
  sel.geom = { x, y, n, iw, ih };

  const iVer = rows.findIndex((r) => r.fase !== 'observado');
  const iFut = rows.findIndex((r) => r.fase === 'futuro');
  const half = n > 1 ? iw / (n - 1) / 2 : 0;
  const edge = (i) => (i <= 0 ? G.l : x(i) - half);
  const bands = sv('g', { class: 'bands' });
  if (iVer >= 0) bands.append(sv('rect', { class: 'band band--ver', x: edge(iVer), y: G.t, width: G.w - G.r - edge(iVer), height: ih }));
  if (iFut >= 0) bands.append(sv('rect', { class: 'band band--fut', x: edge(iFut), y: G.t, width: G.w - G.r - edge(iFut), height: ih }));
  svg.append(bands);

  const grid = sv('g', { class: 'grid' });
  for (const t of ticks) {
    grid.append(sv('line', { x1: G.l, x2: G.w - G.r, y1: y(t), y2: y(t), class: t === 0 ? 'zero' : null }));
    grid.append(sv('text', { x: G.l - 8, y: y(t), class: 'tick', 'font-size': G.fs, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, formatValue(t)));
  }
  monthTicks(grid, rows.map((r) => r.date), x, G, iw, ih);
  svg.append(grid);

  const markers = sv('g', { class: 'markers' });
  if (iVer > 0) {
    const xc = edge(iVer);
    markers.append(sv('line', { class: 'mk mk--corte', x1: xc, x2: xc, y1: G.t - (G.wide ? 6 : 0), y2: G.t + ih }));
    if (G.wide) {
      markers.append(sv('text', { class: 'mk-label mk-label--corte', 'font-size': G.fs, x: xc - 6, y: G.t - 10, 'text-anchor': xc - G.l < 200 ? 'start' : 'end' },
        `Frontera del corte · ${formatDate(series.dsCorte)}`));
    }
  }
  if (iFut > 0) {
    const xl = edge(iFut);
    markers.append(sv('line', { class: 'mk mk--real', x1: xl, x2: xl, y1: G.t - (G.wide ? 6 : 0), y2: G.t + ih }));
    if (G.wide) {
      const stacked = iVer > 0 && xl - edge(iVer) < 260;
      markers.append(sv('text', {
        class: 'mk-label mk-label--real', 'font-size': G.fs, x: xl + 6,
        y: G.t - 10 - (stacked ? G.fs + 4 : 0), 'text-anchor': G.w - G.r - xl < 260 ? 'end' : 'start',
      }, `Último índice observado · ${formatDate(series.lastReal)}`));
    }
  }
  svg.append(markers);

  const path = (field, pred) => {
    let d = '', pen = false;
    rows.forEach((r, i) => {
      const v = r[field];
      if (v === null || !pred(r, i)) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const lines = sv('g', { class: 'lines' });
  if (showPron) {
    const dVer = path('pron', (r) => r.fase === 'verificable');
    const dFut = path('pron', (r, i) => r.fase === 'futuro' || (r.fase === 'verificable' && rows[i + 1]?.fase === 'futuro'));
    if (dVer) lines.append(sv('path', { class: 'ln ln--pron', d: dVer }));
    if (dFut) lines.append(sv('path', { class: 'ln ln--fut', d: dFut }));
    rows.forEach((r, i) => {
      if (r.pron === null) return;
      const isolated = (rows[i - 1]?.pron ?? null) === null && (rows[i + 1]?.pron ?? null) === null;
      if (isolated) lines.append(sv('circle', { class: 'pt pt--pron', cx: x(i), cy: y(r.pron), r: 2.6 * Math.min(G.k, 1.8) }));
    });
  }
  if (showObs) {
    const dObs = path('real', () => true);
    if (dObs) lines.append(sv('path', { class: 'ln ln--obs', d: dObs }));
    rows.forEach((r, i) => {
      if (r.real === null) return;
      const ptR = 2.6 * Math.min(G.k, 1.8);
      if (r.real < 0) {
        lines.append(sv('circle', { class: 'pt pt--rev', cx: x(i), cy: y(r.real), r: ptR + 1 }));
        return;
      }
      const isolated = (rows[i - 1]?.real ?? null) === null && (rows[i + 1]?.real ?? null) === null;
      if (isolated) lines.append(sv('circle', { class: 'pt pt--obs', cx: x(i), cy: y(r.real), r: ptR }));
    });
  }
  svg.append(lines);
  svg.append(sv('g', { id: 'inspector', class: 'inspector' }));

  chart.setAttribute('aria-valuemax', String(n));
  const sum = sel.kpis;
  $('graf-resumen').textContent =
    `Gráfico de ${n} pasos semanales; fechas del índice del ${formatDate(rows[0].date)} al ${formatDate(rows[n - 1].date)}. ` +
    `Unidad: ${unit.label}. ` +
    `${showObs ? `Observado en la ventana y el rango: ${formatInt(sum.observadoVentana.sum)} ${unit.short}. ` : 'Observado oculto. '}` +
    `${showPron ? '' : 'Pronóstico oculto en el dibujo. '}Pronóstico emitido tras el corte: ${formatInt(sum.pronostico.sum)} ${unit.short} en ${sum.pronostico.n} semanas. ` +
    'La tabla semanal contiene los mismos datos.';

  const keep = cursorDate ? rows.findIndex((r) => r.date === cursorDate) : -1;
  setCursor(keep >= 0 ? keep : lastObservedIndex(rows));
}

function lastObservedIndex(rows) {
  const i = rows.findLastIndex((r) => r.real !== null);
  return i >= 0 ? i : 0;
}

function describeRow(r) {
  const fase = FASES[r.fase].label;
  const obs = r.real === null ? (r.fase === 'futuro' ? 'aún sin observar' : 'sin dato') : formatValue(r.real);
  const pron = r.fase === 'observado' ? 'no aplica (previo al corte)' : formatValue(r.pron);
  return { fase, obs, pron, text: `Fecha del índice: ${formatDate(r.date)}. ${fase}. Observado: ${obs}. Pronóstico: ${pron}.` };
}

function setCursor(i) {
  if (!sel?.rows?.length || !sel.geom) return;
  const rows = sel.rows;
  cursor = Math.max(0, Math.min(rows.length - 1, i));
  const r = rows[cursor];
  cursorDate = r.date;
  const { x, y } = sel.geom;
  const g = $('inspector');
  const showObs = state.ser !== 'pronostico';
  const showPron = state.ser !== 'observado';
  if (g) {
    clear(g);
    const rad = 4.5 * Math.min(G.k, 1.8);
    g.append(sv('line', { class: 'cross', x1: x(cursor), x2: x(cursor), y1: G.t, y2: G.h - G.b }));
    if (showObs && r.real !== null) g.append(sv('circle', { class: `dot ${r.real < 0 ? 'dot--rev' : 'dot--obs'}`, cx: x(cursor), cy: y(r.real), r: rad }));
    if (showPron && r.pron !== null) g.append(sv('circle', { class: `dot ${r.fase === 'futuro' ? 'dot--fut' : 'dot--pron'}`, cx: x(cursor), cy: y(r.pron), r: rad }));
  }
  const d = describeRow(r);
  const chart = $('chart');
  chart.setAttribute('aria-valuenow', String(cursor + 1));
  chart.setAttribute('aria-valuetext', d.text);
  $('readout').replaceChildren(
    el('span', { class: 'ro__date' }, `Fecha del índice: ${formatDate(r.date)}`),
    el('span', { class: `ro__fase ro__fase--${r.fase}` }, d.fase),
    el('span', {}, valueUnit(sel.entry.kind, sel.sex).net ? 'Incremento neto observado ' : 'Observado ',
      el('strong', { class: r.real !== null && r.real < 0 ? 'neg' : null }, d.obs)),
    el('span', {}, 'Pronóstico ', el('strong', {}, d.pron)),
  );
}

/** Slider accesible genérico sobre un SVG: puntero y teclado. */
function bindSlider(chart, svg, getGeom, getN, getCursor, setter, geom) {
  const indexFromEvent = (ev) => {
    const g = getGeom();
    if (!g) return null;
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * geom.w;
    if (g.n <= 1) return 0;
    return Math.round(((px - geom.l) / g.iw) * (g.n - 1));
  };
  svg.addEventListener('pointermove', (ev) => {
    const i = indexFromEvent(ev);
    if (i !== null) setter(i);
  });
  svg.addEventListener('pointerdown', (ev) => {
    const i = indexFromEvent(ev);
    if (i !== null) { setter(i); chart.focus({ preventScroll: true }); }
  });
  chart.addEventListener('keydown', (ev) => {
    const n = getN();
    if (!n || !getGeom()) return;
    const moves = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -4, PageUp: 4 };
    let next = null;
    if (ev.key in moves) next = (getCursor() ?? 0) + moves[ev.key];
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = n - 1;
    if (next === null) return;
    ev.preventDefault();
    setter(next);
  });
}

function bindChart() {
  bindSlider($('chart'), $('grafico'), () => sel?.geom, () => sel?.rows?.length ?? 0, () => cursor, setCursor, G);
}

// ── Ficha de la fuente ──────────────────────────────────────────────────────
function renderFicha() {
  const { entry, series, metadata } = sel;
  const dl = $('ficha');
  clear(dl);
  const row = (dt, ...dd) => dl.append(el('div', {}, el('dt', {}, dt), el('dd', {}, ...dd)));
  row('Fuente', safeHref(entry.url) ? el('a', { href: safeHref(entry.url) }, entry.url) : String(entry.url));
  row('Tipo', entry.kind === 'legacy' ? 'Serie histórica por entidad (archivo zoom de la galería)' : 'Release publicado (vista publication_view.v1)');
  if (entry.releaseId) row('Release', el('code', {}, entry.releaseId));
  if (entry.sourceSha256) row('SHA-256 de la fuente', el('code', { class: 'hash' }, entry.sourceSha256));
  row('Semana de origen', formatWeek(entry.origin));
  row('Emisión registrada', formatEmission(entry.emittedAt ?? metadata.emittedAt) ?? 'No declarada en la fuente');
  row('Última semana observada', formatWeek(entry.lastObservation));
  row('Último índice observado de esta serie', formatDate(series.lastReal));
  row('Frontera del corte en el índice', series.dsCorte ? formatDate(series.dsCorte) : 'sin dato');
  row('Estado de publicación', statusBadge(entry), ' ', entry.status?.label ?? STATUS_SHORT[statusKind(entry)]);
  if (entry.status?.verdict) row('Veredicto registrado', `${entry.status.verdict}${weeksText(entry.status) ? ` · ${weeksText(entry.status)}` : ''}`);
  row('Motor asignado a esta serie', series.motor);
  const unit = valueUnit(entry.kind, sel.sex);
  row('Unidad de los valores', unit.net ? `${unit.label} (no son casos nuevos)` : unit.label);
  // API real: metadata.derivedHint = {models, products, portfolioProducts, note} (null en históricos);
  // respaldo en entry.derived = {models, products, portfolioProducts}.
  const hint = metadata.derivedHint && typeof metadata.derivedHint === 'object' ? metadata.derivedHint : null;
  const derived = entry.derived && typeof entry.derived === 'object' ? entry.derived : null;
  const pick = (k) => (isNum(hint?.[k]) ? hint[k] : isNum(derived?.[k]) ? derived[k] : null);
  const products = pick('products');
  const models = pick('models');
  const portfolio = pick('portfolioProducts');
  if (products !== null) row('Productos publicados', `${NF.format(products)} series de producto`);
  if (portfolio !== null) row('Productos derivados (motor portfolio)', `${NF.format(portfolio)} de ${products !== null ? NF.format(products) : 'sin dato'}`);
  if (models !== null) row('Modelos base registrados en la vista', NF.format(models));
  const hintNote = typeof hint?.note === 'string' && hint.note.trim() ? hint.note.trim() : null;
  if (hintNote) row('Nota sobre derivados', hintNote);
  if (safeHref(entry.page)) row('Página del padecimiento', el('a', { href: safeHref(entry.page) }, entry.page));

  const notes = [];
  notes.push('La semana de origen indica desde dónde arranca el pronóstico; no acredita que se emitiera en esa semana. La emisión registrada se muestra aparte.');
  if (entry.kind === 'release') {
    notes.push('La frontera del corte es el índice previo al primer paso pronosticado y sólo clasifica fechas; no es una fecha de emisión.');
    if (!hintNote) notes.push('Un producto publicado no equivale a un modelo entrenado; los nacionales y regionales pueden ser derivados.');
  } else {
    notes.push('Las series históricas no declaran fecha de emisión; sus valores provienen de la serie visual redondeada.');
  }
  if (statusKind(entry) === 'control') notes.push('Control estacional publicado: el portafolio fue rechazado por el gate de aceptación; no es una validación en curso.');
  $('ficha-nota').textContent = notes.join(' ');
}

// ── Motores ─────────────────────────────────────────────────────────────────
function renderMotores() {
  const { raw, index, entry, sex } = sel;
  const dist = motorDistribution(raw, index, sex);
  const list = $('motores');
  clear(list);
  const parts = [];
  if (dist.byTipo.nacional) parts.push('nacional');
  if (dist.byTipo.estado) parts.push(`${dist.byTipo.estado} entidades`);
  if (dist.byTipo.region) parts.push(`${dist.byTipo.region} regiones`);
  const extra = entry.kind === 'release' ? ' En los releases, el motor de un producto derivado identifica cómo se obtuvo, no un modelo entrenado propio.' : '';
  $('mot-nota').textContent = `${entry.labelShort || entry.label}, ${sexLabel(sex).toLowerCase()}: ${dist.total} series (${parts.join(', ')}). Cuenta asignaciones, no desempeño.${extra}`;
  const current = sel.series?.motor;
  for (const item of dist.items) {
    const bar = el('span', { class: 'bar__fill' });
    bar.style.width = `${(item.share * 100).toFixed(1)}%`;
    list.append(el('li', { class: `bar${item.motor === current ? ' is-current' : ''}` },
      el('span', { class: 'bar__label' }, item.motor, item.motor === current ? el('span', { class: 'tag' }, 'esta serie') : null),
      el('span', { class: 'bar__track', 'aria-hidden': 'true' }, bar),
      el('span', { class: 'bar__value' }, `${item.n}`)));
  }
}

// ── Ranking y mapa ──────────────────────────────────────────────────────────
function metricNote() {
  const metric = METRICAS.find((m) => m.id === state.m);
  const w = VENTANAS.find((v) => v.id === state.v);
  const base = state.m === 'observado'
    ? `${metric.label} (${w.label.toLowerCase()}; el rango de fechas no se aplica aquí)`
    : `${metric.label}: suma de los pasos posteriores al corte`;
  const u = valueUnit(sel.entry.kind, sel.sex);
  return `${base}; ${sexLabel(sel.sex).toLowerCase()}. Valores absolutos en ${u.label}, sin ajuste por población.${u.net ? ' No son casos nuevos.' : ''}`;
}

function territoryMeasure(slug) {
  const s = getSeries(sel.raw, sel.index, slug, sel.sex);
  if (!s) return null;
  const rows = buildRows(s);
  return state.m === 'observado'
    ? computeKpis(s, rows, applyWindow(rows, state.v, s)).observadoVentana.sum
    : computeKpis(s, rows, rows).pronostico.sum;
}

function renderRanking() {
  $('f-metrica').value = state.m;
  const { raw, index, sex } = sel;
  const ranking = rankEstados(raw, index, sex, state.m, state.v);
  sel.ranking = ranking;
  const withData = ranking.filter((r) => r.value !== null).length;
  $('rank-titulo').textContent = `Ranking de las ${ESTADOS.length} entidades`;
  $('rank-nota').textContent = `${metricNote()} ${withData < ESTADOS.length ? `${ESTADOS.length - withData} entidades sin serie para esta selección.` : ''}`.trim();
  const max = Math.max(0, ...ranking.map((r) => r.value ?? 0));
  const frag = document.createDocumentFragment();
  for (const item of ranking) {
    const fill = el('span', { class: 'rk__fill' });
    fill.style.width = max > 0 && item.value > 0 ? `${((item.value / max) * 100).toFixed(1)}%` : '0';
    const btn = el('button', {
      type: 'button',
      class: 'rk',
      'aria-pressed': String(item.slug === state.t),
      'aria-label': `${item.rank ? `Lugar ${item.rank}: ` : ''}${item.label}, ${formatInt(item.value)}. Ver su serie.`,
    },
    el('span', { class: 'rk__pos', 'aria-hidden': 'true' }, item.rank ?? '–'),
    el('span', { class: 'rk__name', 'aria-hidden': 'true' }, item.label),
    el('span', { class: 'rk__track', 'aria-hidden': 'true' }, fill),
    el('span', { class: 'rk__val', 'aria-hidden': 'true' }, formatInt(item.value)));
    btn.disabled = item.value === null && !index.entities.has(item.slug);
    btn.addEventListener('click', () => selectTerritory(item.slug));
    frag.append(el('li', {}, btn));
  }
  $('ranking').replaceChildren(frag);

  // Nacional y regiones: referencia aparte; no compiten con las entidades ni se suman.
  const others = [...index.entities.values()].filter((e) => e.tipo !== 'estado');
  const box = $('otros-territorios');
  clear(box);
  if (!others.length) return;
  const list = el('ul', { class: 'others' });
  for (const e of others) {
    const v = territoryMeasure(e.slug);
    const btn = el('button', { type: 'button', class: 'rk rk--other', 'aria-pressed': String(e.slug === state.t) },
      el('span', { class: 'rk__name' }, e.label),
      el('span', { class: 'rk__val' }, formatInt(v)));
    btn.addEventListener('click', () => selectTerritory(e.slug));
    list.append(el('li', {}, btn));
  }
  box.append(el('h3', { class: 'others__title' }, 'Nacional y regiones'),
    el('p', { class: 'hint' }, 'Referencia con la misma medida. No forman parte del ranking y no equivalen a la suma de las entidades.'),
    list);
}

function ensureMap() {
  if (!mapReady) {
    mapReady = load(MAP_URL).then((json) => {
      const model = normalizeMap(json);
      if (!model.viewBox || !model.states.length) throw new Error('geometría inválida');
      mapModel = model;
      buildMap();
    });
    mapReady.catch(() => { mapReady = null; });
  }
  return mapReady;
}

async function renderMap(token) {
  const status = $('mapa-estado');
  $('mapa-nota').textContent = metricNote();
  if (!mapModel) {
    status.hidden = false;
    status.replaceChildren(el('span', {}, 'Cargando mapa…'));
  }
  try {
    await ensureMap();
  } catch (err) {
    if (!latest.isCurrent(token)) return;
    const retry = el('button', { type: 'button', class: 'btn btn--quiet' }, 'Reintentar el mapa');
    retry.addEventListener('click', () => { if (sel) renderMap(sel.token); });
    status.hidden = false;
    status.replaceChildren(el('span', {}, `No se pudo cargar el mapa (${err.message}). El ranking sigue disponible.`), retry);
    return;
  }
  if (!latest.isCurrent(token) || !sel?.ranking) return;
  status.hidden = true;
  paintMap();
}

function buildMap() {
  const svg = $('mapa');
  svg.setAttribute('viewBox', mapModel.viewBox);
  clear(svg);
  for (const st of mapModel.states) {
    const path = sv('path', { d: st.d, 'data-slug': st.slug, tabindex: '0', role: 'button', class: 'st' },
      sv('title', {}, st.label));
    const choose = () => selectTerritory(st.slug);
    path.addEventListener('click', choose);
    path.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choose(); }
    });
    svg.append(path);
  }
}

function paintMap() {
  const byslug = new Map(sel.ranking.map((r) => [r.slug, r]));
  const thresholds = quantileThresholds(sel.ranking.map((r) => r.value), 5);
  for (const path of $('mapa').querySelectorAll('path.st')) {
    const item = byslug.get(path.getAttribute('data-slug'));
    if (!item) continue;
    const b = bucketOf(item.value, thresholds);
    path.setAttribute('class', `st ${b === null ? 'st--nd' : `st--b${b}`}${item.slug === state.t ? ' is-selected' : ''}`);
    const label = `${item.label}: ${formatInt(item.value)}${item.rank ? `, lugar ${item.rank} de ${ESTADOS.length}` : ''}`;
    path.setAttribute('aria-label', `${label}. Ver su serie.`);
    path.setAttribute('aria-pressed', String(item.slug === state.t));
    path.firstChild.textContent = label;
  }
  const legend = $('mapa-leyenda');
  clear(legend);
  const vals = sel.ranking.map((r) => r.value).filter((v) => v !== null);
  if (!vals.length) { legend.append(el('li', {}, 'Sin valores para colorear.')); return; }
  const bounds = [Math.min(...vals), ...thresholds, Math.max(...vals)];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    legend.append(el('li', {}, el('span', { class: `sw st--b${i}`, 'aria-hidden': 'true' }),
      bounds[i] === bounds[i + 1] ? formatInt(bounds[i]) : `${formatInt(bounds[i])} a ${formatInt(bounds[i + 1])}`));
  }
  if (sel.ranking.some((r) => r.value === null)) {
    legend.append(el('li', {}, el('span', { class: 'sw st--nd', 'aria-hidden': 'true' }), 'sin dato'));
  }
}

// ── Tabla y exportes del explorador ─────────────────────────────────────────
function renderTable(pagerButton = null) {
  if (!sel?.rows) return;
  $('f-fase').value = table.fase;
  $('f-filas').value = String(table.size);
  const filtered = filterByFase(sel.rows, table.fase);
  const pg = paginate(filtered, table.page, table.size);
  table.page = pg.page;

  const frag = document.createDocumentFragment();
  for (const r of pg.rows) {
    const d = describeRow(r);
    const cell = (v, kind) => {
      if (v !== null) return el('td', { class: `num${v < 0 ? ' neg' : ''}` }, formatValue(v));
      if (kind === 'pron' && r.fase === 'observado') return el('td', { class: 'num na' }, el('abbr', { title: 'El pronóstico emitido empieza después del corte' }, 'no aplica'));
      if (kind === 'real' && r.fase === 'futuro') return el('td', { class: 'num na' }, 'por observar');
      return el('td', { class: 'num na' }, el('abbr', { title: 'Valor nulo en la fuente: sin dato publicado' }, 'sin dato'));
    };
    frag.append(el('tr', { class: `fase-${r.fase}` },
      el('th', { scope: 'row' }, el('time', { datetime: r.date }, formatDate(r.date))),
      el('td', {}, d.fase),
      cell(r.real, 'real'),
      cell(r.pron, 'pron')));
  }
  if (!pg.rows.length) {
    frag.append(el('tr', { class: 'empty-row' }, el('td', { colspan: '4' }, 'Ninguna semana de la ventana y el rango está en esta fase.')));
  }
  $('tabla-cuerpo').replaceChildren(frag);

  const faseLabel = table.fase === 'todas' ? 'todas las fases' : FASES[table.fase].label.toLowerCase();
  const status = pg.total
    ? `Página ${pg.page} de ${pg.pages} · semanas ${pg.start + 1} a ${pg.end} de ${pg.total} (${faseLabel})`
    : `Sin semanas (${faseLabel})`;
  $('pag-estado').textContent = status;
  const unit = valueUnit(sel.entry.kind, sel.sex);
  $('tabla-caption').textContent = `${$('sel-titulo').textContent}. Unidad: ${unit.label}. ${status}.`;
  $('tabla-obs').textContent = unit.net ? 'Observado (incr. neto)' : 'Observado';
  $('tabla-pron').textContent = unit.net ? 'Pronóstico (incr. neto)' : 'Pronóstico';
  $('pag-primera').disabled = $('pag-anterior').disabled = pg.page <= 1;
  $('pag-siguiente').disabled = $('pag-ultima').disabled = pg.page >= pg.pages;
  if (pagerButton?.disabled) {
    const target = [$('pag-anterior'), $('pag-siguiente')].find((b) => !b.disabled);
    target?.focus();
  }
  const n = sel.rows.length;
  const btn = $('descargar-csv');
  btn.disabled = n === 0;
  btn.textContent = `Descargar CSV (${n} semanas)`;
  $('descargar-svg').disabled = n === 0;
}

function downloadBlob(parts, type, filename) {
  const blob = new Blob(parts, { type });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileBase() {
  const range = state.from || state.to ? `_${state.from ?? 'inicio'}_${state.to ?? 'fin'}` : '';
  return `epiforecast_${slugify(sel.entry.id)}_${sel.slug}_${sel.sex}_${state.v}${range}`;
}

const EXPLORE_COLUMNS = [
  'fecha_indice_serie', 'fase', 'observado', 'pronostico', 'padecimiento', 'cie', 'territorio', 'sexo', 'motor',
  'semana_origen', 'emision_registrada', 'ultima_semana_observada', 'ultimo_indice_observado', 'frontera_corte_indice',
  'estado_publicacion', 'veredicto', 'release_id', 'fuente', 'sha256_fuente', 'nota_valores',
  'unidad', 'nota_incrementos',
];

function downloadExploreCsv() {
  if (!sel?.rows?.length) return;
  const { entry, entity, sex, series } = sel;
  const unit = valueUnit(entry.kind, sex);
  const note = entry.kind === 'legacy'
    ? 'Valores de la serie visual redondeada; celdas vacías = sin dato; fechas del índice'
    : 'Valores publicados en la vista sin redondeo; celdas vacías = sin dato; fechas del índice';
  const fixed = [
    entry.label, entry.cie, entity.label, sexLabel(sex), series.motor,
    weekCode(entry.origin), entry.emittedAt ?? '', weekCode(entry.lastObservation), series.lastReal, series.dsCorte,
    entry.status?.label ?? STATUS_SHORT[statusKind(entry)], entry.status?.verdict ?? '', entry.releaseId ?? '', entry.url, entry.sourceSha256 ?? '', note,
    unit.id, unit.note ?? '',
  ];
  const lines = [EXPLORE_COLUMNS.join(',')];
  for (const r of sel.rows) {
    lines.push([r.date, FASES[r.fase].csv, r.real, r.pron, ...fixed].map(csvField).join(','));
  }
  downloadBlob(['﻿', `${lines.join('\r\n')}\r\n`], 'text/csv;charset=utf-8', `${fileBase()}.csv`);
  announce(`CSV descargado: ${sel.rows.length} semanas con su contexto de origen, emisión, estado y fuente.`);
}

// ── SVG autocontenido ───────────────────────────────────────────────────────
const EXPORT_CSS = `
text { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; fill: #173c33; }
.x-title { font-size: 18px; font-weight: 650; }
.x-meta { font-size: 12px; fill: #40594f; }
.x-foot { font-size: 11px; fill: #61756c; }
.band--ver { fill: #f1f5fa; } .band--fut { fill: #f6f4ea; }
.grid line { stroke: #e7ece5; stroke-width: 1; } .grid line.zero { stroke: #b8c6ba; } .grid .xtick { stroke: #b8c6ba; }
.tick { fill: #61756c; font-weight: 500; }
.mk { stroke-width: 1.5; } .mk--corte { stroke: #a87b27; } .mk--real { stroke: #61756c; stroke-dasharray: 4 3; }
.mk-label { font-weight: 650; } .mk-label--corte { fill: #8a6a1f; } .mk-label--real { fill: #61756c; }
.ln { fill: none; stroke-width: 2.2; stroke-linejoin: round; stroke-linecap: round; }
.ln--obs { stroke: #17644d; } .ln--pron { stroke: #2f5f9e; } .ln--fut { stroke: #2f5f9e; stroke-dasharray: 6 4; }
.pt--obs { fill: #17644d; } .pt--pron { fill: #2f5f9e; } .pt--rev { fill: #c2477f; stroke: #fff; stroke-width: 1.5; }
.cl { fill: none; stroke-width: 2.2; stroke-linejoin: round; stroke-linecap: round; }
.cl--pron { stroke-dasharray: 6 4; stroke-width: 1.8; }
.c0 { stroke: #17644d; fill: #17644d; } .c1 { stroke: #2f5f9e; fill: #2f5f9e; } .c2 { stroke: #a0522d; fill: #a0522d; } .c3 { stroke: #6b4a99; fill: #6b4a99; }
.cl.c0, .cl.c1, .cl.c2, .cl.c3 { fill: none; }
.clabel { font-size: 12px; font-weight: 650; stroke: none; }
.base100 { stroke: #a87b27; stroke-dasharray: 3 3; }
.key-obs { stroke: #17644d; stroke-width: 3; } .key-pron { stroke: #2f5f9e; stroke-width: 3; } .key-fut { stroke: #2f5f9e; stroke-width: 3; stroke-dasharray: 6 4; }
`;

function exportSvg(source, { title, meta, legend = [], foot, filename }) {
  const [, , w, h] = (source.getAttribute('viewBox') ?? '0 0 960 360').split(/\s+/).map(Number);
  // Maqueta pura (svg_export.mjs): envuelve textos largos y calcula alturas con las líneas reales.
  const lay = layoutSvgExport({ width: w, chartHeight: h, title, meta, legend, foot });
  const { total, headH } = lay;
  const out = sv('svg', { xmlns: SVG_NS, viewBox: `0 0 ${w} ${total}`, width: w, height: total, role: 'img' });
  out.append(sv('title', {}, title));
  out.append(sv('desc', {}, [...meta, ...legend.map((l) => l.label), ...foot].join(' ')));
  out.append(sv('style', {}, EXPORT_CSS));
  out.append(sv('rect', { x: 0, y: 0, width: w, height: total, fill: '#ffffff' }));
  const cls = { title: 'x-title', meta: 'x-meta', legend: 'x-meta', foot: 'x-foot' };
  for (const s of lay.swatches) out.append(sv('line', { class: s.cls, x1: s.x1, x2: s.x2, y1: s.y, y2: s.y }));
  for (const t of lay.texts) {
    if (t.role !== 'foot') out.append(sv('text', { class: cls[t.role], x: t.x, y: t.y }, t.text));
  }
  const body = sv('g', { transform: `translate(0 ${headH})` });
  for (const child of source.childNodes) {
    const copy = child.cloneNode(true);
    if (copy.nodeType === 1 && (copy.getAttribute('id') === 'inspector' || copy.getAttribute('class')?.includes('inspector'))) continue;
    body.append(copy);
  }
  out.append(body);
  for (const t of lay.texts) {
    if (t.role === 'foot') out.append(sv('text', { class: 'x-foot', x: t.x, y: t.y }, t.text));
  }
  const xml = new XMLSerializer().serializeToString(out);
  downloadBlob(['<?xml version="1.0" encoding="UTF-8"?>\n', xml], 'image/svg+xml;charset=utf-8', filename);
}

function provenanceLines() {
  const { entry } = sel;
  return [
    `Origen: ${formatWeek(entry.origin)} · Emisión registrada: ${formatEmission(entry.emittedAt) ?? 'no declarada'} · Última semana observada: ${formatWeek(entry.lastObservation)}`,
    `Estado: ${entry.status?.label ?? STATUS_SHORT[statusKind(entry)]}`,
  ];
}

function downloadExploreSvg() {
  if (!sel?.rows?.length || !sel.geom) return;
  const { entry, entity, sex, series } = sel;
  const showObs = state.ser !== 'pronostico';
  const showPron = state.ser !== 'observado';
  const unit = valueUnit(entry.kind, sex);
  const legend = [
    showObs ? { cls: 'key-obs', label: unit.net ? 'Observado (incremento neto)' : 'Observado' } : null,
    showPron ? { cls: 'key-pron', label: 'Pronóstico ya observado' } : null,
    showPron ? { cls: 'key-fut', label: 'Pronóstico aún no observado' } : null,
  ].filter(Boolean);
  exportSvg($('grafico'), {
    title: `${entry.labelShort || entry.label} · ${entity.label} · ${sexLabel(sex)}`,
    meta: [
      ...provenanceLines(),
      `Unidad: ${unit.label}`,
      `Motor: ${series.motor} · Fechas del índice del ${formatDate(sel.rows[0].date)} al ${formatDate(sel.rows[sel.rows.length - 1].date)} · ${VENTANAS.find((v) => v.id === state.v).label}`,
    ],
    legend,
    foot: [
      `Fuente: ${entry.url}${entry.releaseId ? ` · ${entry.releaseId}` : ''}`,
      ...(unit.note ? [unit.note] : []),
      `Fechas del índice de la serie, no calendario del boletín. Pronóstico puntual sin intervalos. Valores absolutos en ${unit.label}, sin ajuste por población. EpiForecast-MX.`,
    ],
    filename: `${fileBase()}.svg`,
  });
  announce('SVG del gráfico descargado con su contexto.');
}

// ── Comparar ────────────────────────────────────────────────────────────────
const CG = { w: 960, h: 380, l: 58, r: 110, t: 20, b: 36, fs: 11, k: 1 };

function bindCompare() {
  $('cmp-agregar-btn').addEventListener('click', () => {
    const slug = $('cmp-agregar').value;
    if (!slug || !sel) return;
    const current = compareSlugs();
    if (current.includes(slug) || current.length >= MAX_CMP) return;
    update({ c: [...current, slug] });
    if ($('cmp-agregar').disabled) $('cmp-chips').querySelector('li:last-child button')?.focus();
    else $('cmp-agregar').focus();
  });
  $('cmp-body').addEventListener('change', (ev) => {
    if (ev.target.name === 'cm') update({ cm: ev.target.value });
  });
  $('cmp-filas').addEventListener('change', (ev) => { cmpTable.size = Number(ev.target.value); cmpTable.page = 1; renderCompareTable(); });
  $('cmp-pag-anterior').addEventListener('click', () => { cmpTable.page -= 1; renderCompareTable(); });
  $('cmp-pag-siguiente').addEventListener('click', () => { cmpTable.page += 1; renderCompareTable(); });
  $('cmp-csv').addEventListener('click', downloadCompareCsv);
  $('cmp-svg').addEventListener('click', downloadCompareSvg);
  bindSlider($('cmp-chart'), $('cmp-grafico'), () => sel?.cmpGeom, () => sel?.cmp?.dates?.length ?? 0, () => cmpCursor, setCmpCursor, CG);
}

function compareSlugs() {
  const list = state.c.length ? state.c : [sel.slug];
  return list.filter((slug) => sel.index.entities.has(slug)).slice(0, MAX_CMP);
}

function renderCompare() {
  const { entry, index, sex, raw } = sel;
  const slugs = compareSlugs();
  $('cmp-titulo').textContent = `${entry.labelShort || entry.label} · ${sexLabel(sex)}`;
  $('cmp-sub').replaceChildren(statusBadge(entry), ' ',
    `Origen ${formatWeek(entry.origin)} · última semana observada ${formatWeek(entry.lastObservation)}. Cambia padecimiento o sexo en la barra de selección.`);
  for (const input of $('cmp-body').querySelectorAll('input[name=cm]')) input.checked = input.value === state.cm;

  // Chips
  const chips = $('cmp-chips');
  clear(chips);
  slugs.forEach((slug, i) => {
    const e = index.entities.get(slug);
    const remove = el('button', { type: 'button', class: 'chip__x', 'aria-label': `Quitar ${e.label} de la comparación` }, 'Quitar');
    remove.disabled = slugs.length <= 1;
    remove.addEventListener('click', () => {
      const next = slugs.filter((s) => s !== slug);
      update({ c: next });
      $('cmp-agregar').focus();
    });
    chips.append(el('li', { class: `chip chip--c${i}` }, el('span', { class: 'chip__sw', 'aria-hidden': 'true' }), e.label, remove));
  });

  // Selector de territorios con la serie del sexo vigente
  const add = $('cmp-agregar');
  const groups = { estado: el('optgroup', { label: 'Entidades federativas' }), region: el('optgroup', { label: 'Regiones' }) };
  const frag = document.createDocumentFragment();
  let available = 0;
  for (const e of index.entities.values()) {
    if (slugs.includes(e.slug)) continue;
    const has = datasetSexes(sel.dataset, e.slug).includes(sex);
    const opt = el('option', { value: e.slug, disabled: !has }, has ? e.label : `${e.label} (sin serie ${sexLabel(sex).toLowerCase()})`);
    if (has) available += 1;
    if (e.tipo === 'nacional') frag.append(opt);
    else groups[e.tipo]?.append(opt);
  }
  if (groups.estado.children.length) frag.append(groups.estado);
  if (groups.region.children.length) frag.append(groups.region);
  add.replaceChildren(frag);
  const full = slugs.length >= MAX_CMP;
  add.disabled = full || !available;
  $('cmp-agregar-btn').disabled = full || !available;
  const firstOk = [...add.options].find((o) => !o.disabled);
  if (firstOk) add.value = firstOk.value;

  $('cmp-rango').textContent = `${full ? 'Ya hay cuatro territorios; quita uno para añadir otro. ' : `Puedes añadir ${MAX_CMP - slugs.length} más. `}` +
    `${state.from || state.to ? `Rango compartido con el explorador: ${state.from ? formatDate(state.from) : 'inicio'} a ${state.to ? formatDate(state.to) : 'fin'}.` : 'Sin rango: se usan todas las fechas comunes.'}`;

  // Comparación
  const items = slugs.map((slug) => ({ id: slug, label: index.entities.get(slug).label, series: getSeries(raw, index, slug, sex) }))
    .filter((it) => it.series);
  const notices = [];
  let cmp = buildComparison(items, { mode: state.cm, from: state.from, to: state.to });
  if (state.cm === 'indexed' && !cmp.indexedAvailable) {
    notices.push(`Base 100 no disponible: ${cmp.reason ?? 'no existe una fecha común con observado positivo en todas las series'}. Se muestran valores absolutos (${valueUnit(entry.kind, sex).label}).`);
    cmp = buildComparison(items, { mode: 'absolute', from: state.from, to: state.to });
  }
  if (slugs.length === 1) notices.push('Añade al menos otro territorio para comparar.');
  if (entry.kind === 'release' && slugs.some((s) => index.entities.get(s).tipo !== 'estado')) {
    notices.push('Los nacionales y regionales de un release pueden ser productos derivados de las series estatales: no son evidencia independiente.');
  }
  const aviso = $('cmp-aviso');
  aviso.hidden = !notices.length;
  aviso.replaceChildren(...notices.map((n) => el('p', {}, n)));
  sel.cmp = cmp;
  sel.cmpItems = items;
  cmpTable.page = Math.max(1, cmpTable.page);

  $('cmp-base').textContent = compareScaleText();

  const legend = $('cmp-leyenda');
  clear(legend);
  cmp.lines.forEach((l, i) => legend.append(el('li', {}, el('span', { class: `sw sw--c${i}`, 'aria-hidden': 'true' }), l.label)));
  legend.append(el('li', {}, el('span', { class: 'sw sw--dash', 'aria-hidden': 'true' }), 'Pronóstico (discontinua)'));

  $('cmp-csv').disabled = !cmp.dates.length;
  $('cmp-svg').disabled = !cmp.dates.length;
  renderCompareChart();
  renderCompareTable();
}

/** Texto de escala y base de la comparación vigente, con la unidad de la serie (pantalla y SVG). */
function compareScaleText() {
  const { entry, sex, cmp } = sel;
  const indexed = cmp.mode === 'indexed' && cmp.baselineDate;
  return comparisonScaleText(entry.kind, sex, indexed ? 'indexed' : 'absolute',
    indexed ? formatDate(cmp.baselineDate) : null,
    cmp.lines.map((l) => ({ label: l.label, value: l.baseline?.value ?? null })), formatValue);
}

/** «en base 100» o «en valores absolutos (unidad)». */
function compareScalePhrase() {
  const { entry, sex, cmp } = sel;
  return cmp.mode === 'indexed'
    ? `en ${scaleLabel('indexed').toLowerCase()} (sobre ${valueUnit(entry.kind, sex).label})`
    : `en ${scaleLabel('absolute').toLowerCase()} (${valueUnit(entry.kind, sex).label})`;
}

function renderCompareChart() {
  const cmp = sel.cmp;
  const svg = $('cmp-grafico');
  clear(svg);
  const chart = $('cmp-chart');
  $('cmp-vacio').hidden = true;
  if (!cmp.dates.length) {
    $('cmp-vacio').hidden = false;
    $('cmp-vacio').textContent = 'Las series elegidas no comparten fechas en el rango.';
    chart.setAttribute('aria-valuemax', '1');
    chart.setAttribute('aria-valuetext', 'Sin datos');
    clear($('cmp-readout'));
    sel.cmpGeom = null;
    return;
  }
  const values = cmp.lines.flatMap((l) => [...l.real, ...l.pron]).filter(isNum);
  const lo = values.length ? Math.min(0, ...values) : 0;
  const hi = values.length ? Math.max(...values) : 1;
  const ticks = niceTicks(lo, hi, 5);
  fitGeometry(svg, ticks.map(formatValue), CG, 380);
  CG.t = 16;
  CG.r = CG.wide ? 120 : 16;
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const iw = CG.w - CG.l - CG.r, ih = CG.h - CG.t - CG.b;
  const n = cmp.dates.length;
  const x = (i) => CG.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v) => CG.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
  sel.cmpGeom = { x, y, n, iw, ih };

  const grid = sv('g', { class: 'grid' });
  for (const t of ticks) {
    grid.append(sv('line', { x1: CG.l, x2: CG.w - CG.r, y1: y(t), y2: y(t), class: t === 0 ? 'zero' : null }));
    grid.append(sv('text', { x: CG.l - 8, y: y(t), class: 'tick', 'font-size': CG.fs, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, formatValue(t)));
  }
  monthTicks(grid, cmp.dates, x, CG, iw, ih);
  svg.append(grid);
  if (cmp.mode === 'indexed' && y0 <= 100 && y1 >= 100) {
    svg.append(sv('line', { class: 'base100', x1: CG.l, x2: CG.w - CG.r, y1: y(100), y2: y(100) }));
  }

  const lines = sv('g', { class: 'lines' });
  const labels = [];
  cmp.lines.forEach((line, li) => {
    for (const [field, cls] of [['real', 'cl'], ['pron', 'cl cl--pron']]) {
      let d = '', pen = false;
      line[field].forEach((v, i) => {
        if (!isNum(v)) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        pen = true;
      });
      if (d) lines.append(sv('path', { class: `${cls} c${li}`, d }));
      line[field].forEach((v, i) => {
        if (!isNum(v)) return;
        if (!isNum(line[field][i - 1]) && !isNum(line[field][i + 1])) lines.append(sv('circle', { class: `c${li}`, cx: x(i), cy: y(v), r: 2.8 * Math.min(CG.k, 1.8) }));
      });
    }
    // Rótulo directo al final de la última posición con valor.
    const lastI = Math.max(line.real.findLastIndex(isNum), line.pron.findLastIndex(isNum));
    if (CG.wide && lastI >= 0) {
      const v = isNum(line.pron[lastI]) ? line.pron[lastI] : line.real[lastI];
      labels.push({ li, yv: y(v), x: x(lastI), text: line.label });
    }
  });
  labels.sort((a, b) => a.yv - b.yv);
  let prevY = -Infinity;
  for (const lab of labels) {
    const yy = Math.max(lab.yv, prevY + CG.fs + 3);
    prevY = yy;
    const short = lab.text.length > 18 ? `${lab.text.slice(0, 17)}…` : lab.text;
    lines.append(sv('text', { class: `clabel c${lab.li}`, x: lab.x + 6, y: yy, 'font-size': CG.fs, 'dominant-baseline': 'middle' }, short));
  }
  svg.append(lines);
  svg.append(sv('g', { id: 'cmp-inspector', class: 'inspector' }));
  chart.setAttribute('aria-valuemax', String(n));
  $('cmp-resumen').textContent = `Comparación de ${cmp.lines.length} territorios en ${n} fechas comunes del índice, del ${formatDate(cmp.dates[0])} al ${formatDate(cmp.dates[n - 1])}, ${compareScalePhrase()}. La tabla contiene los mismos valores.`;
  const keep = cmpCursor !== null && cmpCursor < n ? cmpCursor : Math.max(0, ...cmp.lines.map((l) => l.real.findLastIndex(isNum)));
  setCmpCursor(keep);
}

function setCmpCursor(i) {
  const cmp = sel?.cmp;
  if (!cmp?.dates?.length || !sel.cmpGeom) return;
  cmpCursor = Math.max(0, Math.min(cmp.dates.length - 1, i));
  const { x, y } = sel.cmpGeom;
  const g = $('cmp-inspector');
  if (g) {
    clear(g);
    g.append(sv('line', { class: 'cross', x1: x(cmpCursor), x2: x(cmpCursor), y1: CG.t, y2: CG.h - CG.b }));
    cmp.lines.forEach((l, li) => {
      const v = isNum(l.real[cmpCursor]) ? l.real[cmpCursor] : l.pron[cmpCursor];
      if (isNum(v)) g.append(sv('circle', { class: `dot c${li}`, cx: x(cmpCursor), cy: y(v), r: 4.5 * Math.min(CG.k, 1.8) }));
    });
  }
  const date = cmp.dates[cmpCursor];
  const unit = cmp.mode === 'indexed' ? ' (base 100)' : '';
  const parts = cmp.lines.map((l) => {
    const r = l.real[cmpCursor], p = l.pron[cmpCursor];
    return { label: l.label, obs: isNum(r) ? formatValue(r) : 'sin dato', pron: isNum(p) ? formatValue(p) : null };
  });
  $('cmp-chart').setAttribute('aria-valuenow', String(cmpCursor + 1));
  $('cmp-chart').setAttribute('aria-valuetext', `Fecha del índice ${formatDate(date)}${unit}. ` +
    parts.map((p) => `${p.label}: observado ${p.obs}${p.pron ? `, pronóstico ${p.pron}` : ''}`).join('. '));
  $('cmp-readout').replaceChildren(
    el('span', { class: 'ro__date' }, `Fecha del índice: ${formatDate(date)}${unit}`),
    ...parts.map((p, i) => el('span', { class: 'ro__item' },
      el('span', { class: `sw sw--c${i}`, 'aria-hidden': 'true' }), `${p.label}: `,
      el('strong', {}, p.obs), p.pron ? ` · pron. ${p.pron}` : '')));
}

function renderCompareTable() {
  const cmp = sel?.cmp;
  if (!cmp) return;
  $('cmp-filas').value = String(cmpTable.size);
  const head = el('tr', {}, el('th', { scope: 'col' }, 'Fecha del índice'));
  for (const l of cmp.lines) {
    head.append(el('th', { scope: 'col', class: 'num' }, `${l.label}: observado`));
    head.append(el('th', { scope: 'col', class: 'num' }, `${l.label}: pronóstico`));
  }
  $('cmp-thead').replaceChildren(head);
  const rows = cmp.dates.map((date, i) => ({ date, i }));
  const pg = paginate(rows, cmpTable.page, cmpTable.size);
  cmpTable.page = pg.page;
  const frag = document.createDocumentFragment();
  for (const { date, i } of pg.rows) {
    const tr = el('tr', {}, el('th', { scope: 'row' }, el('time', { datetime: date }, formatDate(date))));
    for (const l of cmp.lines) {
      for (const v of [l.real[i], l.pron[i]]) {
        tr.append(isNum(v)
          ? el('td', { class: `num${v < 0 ? ' neg' : ''}` }, formatValue(v))
          : el('td', { class: 'num na' }, 'sin dato'));
      }
    }
    frag.append(tr);
  }
  if (!pg.rows.length) frag.append(el('tr', { class: 'empty-row' }, el('td', { colspan: String(1 + cmp.lines.length * 2) }, 'Sin fechas comunes en el rango.')));
  $('cmp-tbody').replaceChildren(frag);
  $('cmp-pag-estado').textContent = pg.total ? `Página ${pg.page} de ${pg.pages} · fechas ${pg.start + 1} a ${pg.end} de ${pg.total}` : 'Sin fechas';
  $('cmp-pag-anterior').disabled = pg.page <= 1;
  $('cmp-pag-siguiente').disabled = pg.page >= pg.pages;
  $('cmp-caption').textContent = `Comparación de ${cmp.lines.map((l) => l.label).join(', ')} ${compareScalePhrase()}.`;
}

function compareMeta() {
  const { entry, sex } = sel;
  return {
    padecimiento: entry.label,
    cie: entry.cie ?? '',
    sexo: sexLabel(sex),
    modo: sel.cmp.mode === 'indexed' ? 'base 100' : 'valores absolutos',
    unidad: comparisonUnitId(entry.kind, sex, sel.cmp.mode),
    baselineDate: sel.cmp.baselineDate ?? '',
    desde: state.from ?? '',
    hasta: state.to ?? '',
    // analytics.comparisonCSV lee origen/corte; semanaOrigen/ultimaSemanaObservada se conservan como alias.
    origen: weekCode(entry.origin) ?? '',
    corte: weekCode(entry.lastObservation) ?? '',
    semanaOrigen: weekCode(entry.origin) ?? '',
    emision: entry.emittedAt ?? '',
    ultimaSemanaObservada: weekCode(entry.lastObservation) ?? '',
    nota: [
      entry.kind === 'legacy'
        ? 'Valores de la serie visual redondeada; fechas del índice; sin suma entre territorios'
        : 'Valores publicados en la vista sin redondeo; fechas del índice; sin suma entre territorios',
      valueUnit(entry.kind, sex).net
        ? `${valueUnit(entry.kind, sex).note}${sel.cmp.mode === 'indexed' ? ' La base 100 es un incremento neto del acumulado, no casos nuevos.' : ''}`
        : null,
    ].filter(Boolean).join('. '),
    estado: entry.status?.label ?? STATUS_SHORT[statusKind(entry)],
    veredicto: entry.status?.verdict ?? '',
    releaseId: entry.releaseId ?? '',
    fuente: entry.url,
    sha256: entry.sourceSha256 ?? '',
  };
}

function cmpFileBase() {
  const range = state.from || state.to ? `_${state.from ?? 'inicio'}_${state.to ?? 'fin'}` : '';
  return `epiforecast_comparacion_${slugify(sel.entry.id)}_${sel.sex}_${sel.cmp.mode}${range}`;
}

function downloadCompareCsv() {
  if (!sel?.cmp?.dates?.length) return;
  const csv = comparisonCSV(sel.cmp, compareMeta());
  downloadBlob(['﻿', csv], 'text/csv;charset=utf-8', `${cmpFileBase()}.csv`);
  announce(`CSV de la comparación descargado: ${sel.cmp.dates.length} fechas comunes.`);
}

function downloadCompareSvg() {
  if (!sel?.cmp?.dates?.length || !sel.cmpGeom) return;
  const { entry, sex, cmp } = sel;
  exportSvg($('cmp-grafico'), {
    title: `${entry.labelShort || entry.label} · ${sexLabel(sex)} · comparación territorial`,
    // compareScaleText incluye unidad, base y, en incrementos netos, la advertencia correspondiente.
    meta: [...provenanceLines(), `Escala: ${scaleLabel(cmp.mode)} · Unidad: ${valueUnit(entry.kind, sex).label}`, compareScaleText()],
    legend: [
      ...cmp.lines.map((l, i) => ({ cls: `cl c${i}`, label: l.label })),
      { cls: 'key-fut', label: 'Pronóstico (discontinua)' },
    ],
    foot: [
      `Fuente: ${entry.url}${entry.releaseId ? ` · ${entry.releaseId}` : ''}`,
      `Fechas comunes del índice del ${formatDate(cmp.dates[0])} al ${formatDate(cmp.dates[cmp.dates.length - 1])}; sin relleno de huecos ni suma de territorios. ${cmp.mode === 'indexed' ? 'Índice base 100' : `Valores absolutos en ${valueUnit(entry.kind, sex).label}`}, sin ajuste por población. EpiForecast-MX.`,
    ],
    filename: `${cmpFileBase()}.svg`,
  });
  announce('SVG de la comparación descargado.');
}

// ── Perfil temporal ─────────────────────────────────────────────────────────
function bindProfile() {
  $('prof-body').addEventListener('change', (ev) => {
    if (ev.target.name === 'pm') update({ pm: ev.target.value }, { push: false });
  });
  $('prof-quitar').addEventListener('click', () => update({ from: null, to: null }));
  $('prof-explorar').addEventListener('click', () => update({ vista: 'explorar' }));
}

function renderProfile() {
  const { entry, entity, sex, series } = sel;
  $('prof-titulo').textContent = `${entry.labelShort || entry.label} · ${entity.label} · ${sexLabel(sex)}`;
  $('prof-sub').replaceChildren(statusBadge(entry), ' ',
    `Observado del índice en ${valueUnit(entry.kind, sex).label}, del ${formatDate(series.d[0])} al ${formatDate(series.lastReal ?? series.d[series.d.length - 1])}. Cambia la serie en la barra de selección.`);
  for (const input of $('prof-body').querySelectorAll('input[name=pm]')) input.checked = input.value === state.pm;

  const prof = temporalProfile(series);
  const field = state.pm === 'suma' ? 'sum' : 'mean';
  const thead = $('prof-thead');
  const tbody = $('prof-tbody');
  thead.replaceChildren(el('tr', {},
    el('th', { scope: 'col' }, 'Año'),
    ...MESES.map((m, i) => el('th', { scope: 'col', class: 'num' }, el('abbr', { title: MESES_LARGOS[i] }, m))),
    el('th', { scope: 'col', class: 'num' }, 'Meses con dato')));
  clear(tbody);
  if (!prof.years.length) {
    tbody.append(el('tr', { class: 'empty-row' }, el('td', { colspan: '14' }, 'La serie no tiene observados en el índice.')));
    clear($('prof-leyenda'));
    renderProfileDetail(null, prof);
    return;
  }
  const values = prof.cells.map((c) => c[field]).filter(isNum);
  const thresholds = quantileThresholds(values, 5);
  const byKey = new Map(prof.cells.map((c) => [`${c.year}-${c.month}`, c]));
  let selected = null;
  for (const year of prof.years) {
    const cells = Array.from({ length: 12 }, (_, i) => byKey.get(`${year}-${i + 1}`) ?? { year, month: i + 1, sum: null, mean: null, n: 0, missing: 0, negative: 0, first: null, last: null });
    const partial = cells.some((c) => c.n + c.missing === 0);
    const tr = el('tr', {}, el('th', { scope: 'row' }, String(year), partial ? el('span', { class: 'heat__partial' }, ' parcial') : null));
    for (const c of cells) {
      if (c.n + c.missing === 0) {
        tr.append(el('td', { class: 'heat__out' }, el('span', { 'aria-hidden': 'true' }, '–'), el('span', { class: 'sr-only' }, 'sin fechas en el índice')));
        continue;
      }
      const v = c[field];
      const b = bucketOf(v, thresholds);
      const isSel = Boolean(state.from && state.to && c.first && c.last && c.first === state.from && c.last === state.to);
      if (isSel) selected = c;
      const inSel = Boolean(c.first && c.last && (state.from || state.to) && c.first >= (state.from ?? '0000') && c.last <= (state.to ?? '9999'));
      const label = `${MESES_LARGOS[c.month - 1]} de ${year}: ${state.pm === 'suma' ? 'suma' : 'promedio semanal'} ${formatValue(v)}; ${c.n} ${c.n === 1 ? 'valor' : 'valores'}${c.missing ? `, ${c.missing} sin dato` : ''}${c.negative ? `, ${c.negative} negativos` : ''}. Fijar este rango.`;
      const btn = el('button', {
        type: 'button',
        class: `heat__cell ${b === null ? 'st--nd' : `st--b${b}`}${b !== null && b >= 3 ? ' is-dark' : ''}`,
        'aria-pressed': String(isSel),
        'aria-label': label,
        title: label,
      },
      el('span', { class: 'heat__v' }, isNum(v) ? formatValue(v) : 'sin dato'),
      el('span', { class: 'heat__n' }, `n=${c.n}${c.missing ? ` · ${c.missing} s/d` : ''}`));
      btn.addEventListener('click', () => {
        if (!c.first || !c.last) return;
        update({ from: c.first, to: c.last }, { push: true });
        $('prof-tbody').querySelector('button[aria-pressed="true"]')?.focus(); // la matriz se redibuja
        announce(`Rango fijado: ${MESES_LARGOS[c.month - 1]} de ${year}, del ${formatDate(c.first)} al ${formatDate(c.last)}.`);
      });
      tr.append(el('td', { class: inSel ? 'in-range' : null }, btn));
    }
    tr.append(el('td', { class: 'num' }, String(cells.filter((c) => c.n > 0).length)));
    tbody.append(tr);
  }
  $('prof-caption').textContent = `Observado por año y mes (${valueUnit(entry.kind, sex).label}), ${state.pm === 'suma' ? 'suma' : 'promedio semanal'} por celda.`;

  const legend = $('prof-leyenda');
  clear(legend);
  if (values.length) {
    const bounds = [Math.min(...values), ...thresholds, Math.max(...values)];
    for (let i = 0; i < bounds.length - 1; i += 1) {
      legend.append(el('li', {}, el('span', { class: `sw st--b${i}`, 'aria-hidden': 'true' }),
        bounds[i] === bounds[i + 1] ? formatValue(bounds[i]) : `${formatValue(bounds[i])} a ${formatValue(bounds[i + 1])}`));
    }
  }
  legend.append(el('li', {}, el('span', { class: 'sw st--nd', 'aria-hidden': 'true' }), 'sin valores observados'));
  legend.append(el('li', {}, el('span', { class: 'sw sw--out', 'aria-hidden': 'true' }), 'mes fuera del índice'));
  renderProfileDetail(selected, prof);
}

function renderProfileDetail(cell, prof) {
  const box = $('prof-detalle');
  clear(box);
  $('prof-quitar').disabled = !state.from && !state.to;
  if (cell) {
    const dl = el('dl', { class: 'ficha ficha--compact' });
    const row = (dt, dd) => dl.append(el('div', {}, el('dt', {}, dt), el('dd', {}, dd)));
    row('Mes', `${MESES_LARGOS[cell.month - 1]} de ${cell.year}`);
    row('Fechas del índice', `${formatDate(cell.first)} a ${formatDate(cell.last)}`);
    row('Valores observados', String(cell.n));
    row('Fechas sin dato', String(cell.missing));
    row('Valores negativos', String(cell.negative));
    row('Suma', formatValue(cell.sum));
    row('Promedio semanal', formatValue(cell.mean));
    box.append(dl);
  } else if (state.from || state.to) {
    box.append(el('p', {}, `Rango fijado: ${state.from ? formatDate(state.from) : 'inicio'} a ${state.to ? formatDate(state.to) : 'fin'} (no coincide con una sola celda).`));
  } else {
    box.append(el('p', { class: 'hint' }, 'Ninguna celda seleccionada. Pulsa una celda para fijar su rango.'));
  }
  const all = prof.cells;
  const n = all.reduce((a, c) => a + c.n, 0);
  const miss = all.reduce((a, c) => a + c.missing, 0);
  const neg = all.reduce((a, c) => a + c.negative, 0);
  $('prof-resumen').textContent = `La matriz reúne ${NF.format(n)} valores observados y ${NF.format(miss)} fechas sin dato${neg ? `, con ${NF.format(neg)} valores negativos conservados` : ''}. ` +
    'Los años marcados como parciales tienen meses fuera del índice: sus filas no son comparables como años completos.' +
    (valueUnit(sel.entry.kind, sel.sex).note ? ` ${valueUnit(sel.entry.kind, sel.sex).note}` : '');
}

// ── Vigilancia (módulo independiente, importado al abrir la pestaña) ───────
function ensureSurveillance() {
  if (survReady || survPromise) return survPromise;
  const root = $('surveillance-root');
  $('vig-error').hidden = true;
  $('vig-cargando').hidden = false;
  survPromise = import('./surveillance.mjs')
    .then((mod) => {
      if (typeof mod.initSurveillance !== 'function') throw new Error('el módulo no expone initSurveillance');
      return mod.initSurveillance({ root, load, onSelectForecast });
    })
    .then(() => {
      survReady = true;
      $('vig-cargando').hidden = true;
    })
    .catch((err) => {
      survPromise = null;
      clear(root);
      $('vig-cargando').hidden = true;
      $('vig-error').hidden = false;
      $('vig-error-msg').textContent = `No se pudo cargar la vigilancia del boletín (${err?.message ?? 'error desconocido'}). Reintenta en unos momentos.`;
    });
  return survPromise;
}

function onSelectForecast(id) {
  if (!catalogById.has(id)) {
    announce(`El pronóstico «${id}» no está en el catálogo publicado del dashboard.`);
    return;
  }
  openDisease(id, 'explorar');
}

// ── Archivo Tableau (sólo con ?archivo=tableau) ─────────────────────────────
function enterArchive() {
  archiveActive = true;
  route();
}

function leaveArchive() {
  archiveActive = false;
  $('tab-archivo').hidden = true;
  clear($('archivo-frame'));
  $('cargar-archivo').disabled = false;
  $('cargar-archivo').textContent = 'Cargar el archivo histórico';
}

function setupArchive() {
  if (!state.archivo) return; // experiencia normal: cero recursos de Tableau
  $('tab-archivo').hidden = false;
  $('cargar-archivo').addEventListener('click', (ev) => {
    const frame = $('archivo-frame');
    if (frame.firstChild) return;
    frame.append(el('iframe', {
      src: TABLEAU_ARCHIVE_URL,
      title: 'Archivo histórico de tableros Tableau',
      loading: 'lazy',
      referrerpolicy: 'strict-origin-when-cross-origin',
    }));
    ev.currentTarget.disabled = true;
    ev.currentTarget.textContent = 'Archivo histórico cargado';
  });
}

init();
