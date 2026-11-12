// galeria.mjs — controlador de la Galería de pronósticos (piloto por padecimiento).
// La lógica vive en galeria_core.mjs; aquí sólo se orquesta y se dibuja.
// Seguridad: el DOM se construye con createElement y nodos de texto; ningún dato se interpreta
// como marcado y los href pasan por safeHref (sólo rutas del sitio). No se pintan métricas de error.
// ?v= en el import: subir el número junto con el de Reports/index.html (import y modulepreload).
// Probado con DOM simulado en tests/galeria_controller.test.mjs.
import * as C from './galeria_core.mjs?v=2';
import { validateCatalog } from '../assets/dashboard/unified.mjs';
import { COHORTS } from '../assets/dashboard/data.mjs';

const $ = (id) => document.getElementById(id);
const CATALOG_URL = '../assets/dashboard/catalog.json';
const DATA = Array.isArray(window.GALERIA_LEGACY) ? window.GALERIA_LEGACY : [];
const REGION_META = window.REGION_META || {};
const NF = new Intl.NumberFormat('es-MX');
// Caché que guarda resultados ya validados: un esquema inválido se olvida y se puede reintentar.
const load = C.createValidatedLoader((url, init) => window.fetch(url, init));
const latest = C.createLatest();
const viewerLatest = C.createLatest();

let catalog = null;
let state = { p: null, ...C.DEFAULT_DETAIL };
let mode = 'catalog'; // 'catalog' | 'detail' | 'all'
let source = null; // fuente del padecimiento elegido (null mientras carga o tras un fallo)
let allSources = new Map();
let allRun = null; // corrida vigente de la lista completa: {id, abort}
let allRunSeq = 0;
let list = [];
let page = 1;
let opener = null;
let problemsShown = [];

// ── DOM seguro ───────────────────────────────────────────────────────────────
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'href') {
      const h = C.safeHref(v);
      if (h) node.setAttribute('href', h);
      else { node.setAttribute('aria-disabled', 'true'); node.dataset.hrefInvalido = ''; console.warn('[galería] enlace descartado por no ser una ruta del sitio:', v); }
    } else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return node;
}
const css = getComputedStyle(document.documentElement);
const token = (name, fb) => css.getPropertyValue(name).trim() || fb;
const colorOf = (entry) => token(`--series-${C.seriesSlot(entry.id)}`, '#2f5f9e');
const obsColor = () => token('--c-obs', '#173c33');
const humanError = (what) => `No pudimos cargar ${what}. Revisa tu conexión e inténtalo de nuevo.`;
const logError = (what, err) => console.warn(`[galería] ${what}:`, err);

// ── Catálogo ─────────────────────────────────────────────────────────────────
const ensureCatalog = () => load(CATALOG_URL, validateCatalog, 'catalogo').then((c) => { catalog = c; return c; });

function spark(points) {
  const vals = points.map((p) => p[1]);
  if (vals.length < 2) return null;
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const W = 120, H = 28;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * W).toFixed(1)},${(H - 2 - (mx === mn ? 0.5 : (v - mn) / (mx - mn)) * (H - 4)).toFixed(1)}`).join(' ');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'g-spark');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  line.setAttribute('points', pts);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', obsColor()); // es OBSERVADO (últimas 26 semanas), nunca pronóstico
  line.setAttribute('stroke-width', '2');
  line.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(line);
  return svg;
}

function renderSummary() {
  const s = C.catalogSummary(catalog);
  $('gSummary').textContent = `${NF.format(s.diseases)} padecimientos · ${NF.format(s.series)} series`;
  $('gSummaryDetail').textContent = `Cohorte original: ${s.legacy.n} padecimientos, ${NF.format(s.legacy.series)} series. ` +
    `Resto: ${s.release.n} padecimientos, ${NF.format(s.release.series)} series.`;
}

function renderCatalog() {
  const q = $('gSearch').value;
  const st = $('gStatus').value;
  const items = catalog.diseases.filter((d) => (!st || d.status.kind === st)
    && C.matchesQuery(`${d.label} ${d.labelShort} ${d.cie ?? ''} ${d.group} ${d.id.replace(/_/g, ' ')}`, q));
  $('gDiseases').replaceChildren(...items.map((d) => {
    const f = C.entryFacts(d);
    const nat = d.national.general ?? Object.values(d.national)[0];
    const btn = el('button', { type: 'button', class: 'g-disease__open', 'data-p': d.id, onclick: (e) => selectDisease(d.id, e.currentTarget) }, d.labelShort);
    return el('li', {},
      el('article', { class: `g-disease g-disease--${d.status.kind}` },
        el('div', { class: 'g-disease__top' },
          el('h3', {}, btn),
          el('span', { class: `g-chip g-chip--${d.status.kind}` }, f.estadoCorto)),
        el('p', { class: 'g-disease__facts' }, [d.cie ? `CIE-10 ${d.cie}` : null, `${NF.format(d.nSeries)} series`, `observado hasta la ${f.observado}`].filter(Boolean).join(' · ')),
        nat ? spark(nat.spark) : null));
  }));
  $('gDiseasesEmpty').hidden = items.length > 0;
  $('gCatalogCount').textContent = q || st ? `${items.length} de ${catalog.diseases.length}` : '';
}

// ── Avisos de URL ────────────────────────────────────────────────────────────
function showProblems(problems) {
  problemsShown = problems;
  const box = $('gNotice');
  if (!problems.length) { box.hidden = true; box.replaceChildren(); return; }
  box.replaceChildren(
    el('p', { class: 'g-notice__title' }, 'Algunos parámetros del enlace no se pudieron usar:'),
    el('ul', {}, problems.map((p) => el('li', {}, p.message))),
    el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { history.replaceState(null, '', location.pathname); showProblems([]); readUrlAndRoute(); } }, 'Limpiar el enlace'));
  box.hidden = false;
}

// ── Enrutado ─────────────────────────────────────────────────────────────────
function writeUrl(push) {
  const next = C.serializeGalleryState(state);
  if (location.search === next) return;
  const url = location.pathname + next;
  if (push) history.pushState(null, '', url); else history.replaceState(null, '', url);
}

function readUrlAndRoute() {
  const { state: st, problems } = C.parseGalleryState(location.search, catalog);
  state = st;
  showProblems(problems);
  if (problems.length) writeUrl(false);
  route();
}

function route({ focus = false } = {}) {
  if (!state.p) {
    if (mode === 'all') return; // la lista completa no vive en la URL
    mode = 'catalog';
    $('gCatalog').hidden = false;
    $('gDetail').hidden = true;
    document.title = 'EpiForecast-MX | Galería de Pronósticos';
    if (focus) (opener && opener.isConnected ? opener : $('gCatalogTitle')).focus?.();
    return;
  }
  mode = 'detail';
  const entry = catalog.diseases.find((d) => d.id === state.p);
  $('gCatalog').hidden = true;
  $('gDetail').hidden = false;
  document.title = `${entry.labelShort} | Galería de Pronósticos · EpiForecast-MX`;
  renderDetailHead(entry);
  renderControls(entry);
  if (focus) $('gDetailTitle').focus();
  loadDetail(entry);
}

/** Sale de la lista completa SIN promover lo cargado: invalida la corrida y restaura sus controles. */
function leaveAll() {
  latest.next(); // invalida cualquier carga de detalle en vuelo (éxito o error rezagado)
  if (allRun) { allRun.abort.abort(); allRun = null; }
  allSources = new Map();
  $('gAllLoad').disabled = false;
  $('gAllCancel').hidden = true;
  $('gAllProgress').hidden = true;
  $('gAllErrors').replaceChildren();
  if (mode === 'all') mode = 'catalog';
}

function selectDisease(id, from) {
  leaveAll();
  opener = from ?? null;
  state = { p: id, ...C.DEFAULT_DETAIL };
  showProblems([]);
  writeUrl(true);
  route({ focus: true });
}

function backToCatalog() {
  leaveAll();
  state = { p: null, ...C.DEFAULT_DETAIL };
  writeUrl(true);
  route({ focus: true });
}

// ── Detalle ──────────────────────────────────────────────────────────────────
function linksFor(entry) {
  const caps = C.capabilities(entry);
  return [
    el('a', { class: 'text-link', href: `../${entry.page}` }, caps.ficha ? 'Página del padecimiento' : 'Método'),
    el('a', { class: 'text-link', href: C.dashboardHref(state) }, 'Abrir en el Dashboard'),
    el('a', { class: 'text-link', href: C.sourceUrl(entry) }, 'Datos (JSON)'),
  ];
}

function renderDetailHead(entry) {
  const f = C.entryFacts(entry);
  const caps = C.capabilities(entry);
  $('gDetailKicker').textContent = [entry.cie ? `CIE-10 ${entry.cie}` : null, entry.group].filter(Boolean).join(' · ');
  $('gDetailTitle').textContent = entry.label;
  $('gDetailStatus').replaceChildren(el('span', { class: `g-chip g-chip--${entry.status.kind}` }, f.estadoCorto), f.estadoDetalle ? ` ${f.estadoDetalle}` : '');
  $('gDetailLinks').replaceChildren(...linksFor(entry));
  const facts = [
    [f.corteRotulo, f.corte], ['Último observado', f.observado], ['Emisión', f.emision],
    ['Series', `${NF.format(f.series)} (${f.sexos})`], ['Intervalos', caps.intervalo], ['Valores', f.redondeo],
  ];
  $('gFacts').replaceChildren(...facts.map(([k, v]) => el('div', {}, el('dt', {}, k), el('dd', {}, v))));
}

function setFiltersEnabled(on) {
  for (const id of ['gNivel', 'gTerritorio', 'gQ']) $(id).disabled = !on;
  if (!on) $('gSexo').disabled = true;
  for (const b of $('gViews').querySelectorAll('button')) if (!on) b.disabled = true;
}

function renderControls(entry) {
  const caps = C.capabilities(entry);
  const all = mode === 'all';
  $('gNivel').value = state.t ? nivelOfT() : state.nivel;
  $('gTerritorio').closest('label').hidden = all;
  $('gQLabel').hidden = !all;
  const sexOpts = all ? ['general', 'hombres', 'mujeres', 'todos'] : caps.sexo.options;
  $('gSexo').replaceChildren(...sexOpts.map((s) => el('option', { value: s }, C.SEXO_LABEL[s])));
  $('gSexo').value = state.s;
  $('gSexo').disabled = !all && !caps.sexo.enabled;
  $('gSexoReason').hidden = all || caps.sexo.enabled;
  $('gSexoReason').textContent = caps.sexo.reason ?? '';
  const graficas = all ? C.GRAFICAS.map((g) => ({ ...g, enabled: g.id === 'full' || g.id === 'zoom', reason: g.id === 'full' || g.id === 'zoom' ? null : 'En la lista completa sólo hay histórico y zoom; las demás vistas dependen del padecimiento.' })) : caps.graficas;
  $('gViews').replaceChildren(...graficas.map((g) => el('button', {
    type: 'button', class: 'g-view', 'data-view': g.id, title: g.enabled ? g.title : g.reason,
    'aria-pressed': String(state.grafica === g.id), disabled: !g.enabled,
    'aria-describedby': g.enabled ? null : 'gViewsReason',
    onclick: () => { state.grafica = g.id; if (mode === 'detail') writeUrl(false); renderControls(entry); renderList(); },
  }, g.label)));
  const reasons = graficas.filter((g) => !g.enabled).map((g) => `${g.label}: ${g.reason}`);
  $('gViewsReason').textContent = reasons.join(' ');
  $('gViewsReason').hidden = !reasons.length;
  if (!all && !source) setFiltersEnabled(false);
}

function nivelOfT() {
  const e = source?.entities.get(state.t);
  if (!e) return state.t === 'nacional' ? 'nacional' : state.nivel;
  return { nacional: 'nacional', estado: 'estatal', region: 'regional' }[e.tipo];
}

function territoryOptions() {
  const sel = $('gTerritorio');
  sel.replaceChildren(
    el('option', { value: '' }, 'Todos los del nivel'),
    ...C.territoryGroups(source).map((g) => el('optgroup', { label: g.label }, g.items.map((it) => el('option', { value: it.slug }, it.label)))));
  sel.value = state.t || '';
}

/** Fuente validada y cacheada; un error (HTTP o esquema) no queda en caché. */
function loadSource(entry) {
  if (entry.kind === 'legacy') return Promise.resolve().then(() => C.legacySource(entry, DATA));
  return load(C.sourceUrl(entry), (v) => C.releaseSource(entry, v), `fuente:${entry.id}`);
}

function clearResults() {
  $('gCards').replaceChildren();
  $('gCardsEmpty').hidden = true;
  $('gPager').hidden = true;
  $('gResultCount').textContent = '';
  $('gRegionNote').hidden = true;
  $('gLegend').hidden = true;
}

function loadDetail(entry) {
  const tok = latest.next();
  source = null;
  clearResults();
  setFiltersEnabled(false);
  $('gDetailError').hidden = true;
  $('gDetailLoading').hidden = false;
  loadSource(entry).then((src) => {
    if (!latest.isCurrent(tok) || mode !== 'detail' || state.p !== entry.id) return; // superada
    source = src;
    $('gDetailLoading').hidden = true;
    const r = C.resolveTerritory(src, state.t);
    if (r.fallback) {
      showProblems([...problemsShown, { param: 't', value: state.t, message: `El territorio «${state.t}» no existe para ${entry.labelShort}; se muestra el total nacional.` }]);
      state.t = r.t;
      writeUrl(false);
    }
    territoryOptions();
    renderControls(entry);
    setFiltersEnabled(true);
    $('gSexo').disabled = !C.capabilities(entry).sexo.enabled;
    $('gNivel').value = state.t ? nivelOfT() : state.nivel;
    $('gDetailLinks').replaceChildren(...linksFor(entry));
    page = 1;
    renderList();
  }).catch((err) => {
    if (!latest.isCurrent(tok) || mode !== 'detail' || state.p !== entry.id) return; // superada
    logError(`fuente de ${entry.id}`, err);
    $('gDetailLoading').hidden = true;
    $('gDetailError').hidden = false;
    $('gDetailErrorMsg').textContent = `${humanError(`los datos de ${entry.labelShort}`)} Ninguna serie se muestra como cero.`;
  });
}

// ── Lista de tarjetas ────────────────────────────────────────────────────────
const pool = C.createChartPool({ limit: C.PAGE_SIZE, create: (canvas) => drawCardChart(canvas), destroy: (chart) => chart?.destroy?.() });
const io = typeof window.IntersectionObserver === 'function'
  ? new window.IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { io.unobserve(e.target); pool.request(e.target); }
  }), { rootMargin: '200px' })
  : null;

function currentList() {
  if (mode === 'all') {
    const q = $('gQ').value;
    return catalog.diseases.flatMap((d) => (allSources.has(d.id) ? C.listSeries(allSources.get(d.id), { t: '', nivel: state.nivel, s: state.s, q }) : []));
  }
  return source ? C.listSeries(source, { t: state.t, nivel: state.nivel, s: state.s }) : [];
}

function srcOfItem(it) { return mode === 'all' ? allSources.get(it.entry.id) : source; }

/** Lámina PNG con error visible: nunca sustituye en silencio otra vista. */
function pngImage(item, grafica, alt, onFail) {
  const img = el('img', { alt, loading: 'lazy', decoding: 'async', width: 640, height: 400 });
  img.addEventListener('error', () => onFail(img));
  img.setAttribute('src', encodeURI(C.pngFor(item, grafica)));
  return img;
}

/**
 * Error de lámina en una tarjeta: aviso visible FUERA del botón (no se anidan controles), con
 * «Reintentar» y, si la vista no es el histórico, «Ver el histórico» como acción explícita.
 */
function cardImgError(getArticle, item, grafica) {
  return (img) => {
    const art = getArticle();
    if (!art || art.querySelector('.g-card__imgerr')) return;
    const g = C.GRAFICAS.find((x) => x.id === grafica);
    img.hidden = true;
    const box = el('div', { class: 'g-card__imgerr', role: 'status' }, el('p', {}, `No se pudo cargar la lámina «${g.label}».`));
    box.append(el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => {
      box.remove(); img.hidden = false; img.removeAttribute('src'); img.setAttribute('src', encodeURI(C.pngFor(item, grafica)));
    } }, 'Reintentar'));
    if (grafica !== 'full') {
      box.append(el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => {
        box.replaceChildren(el('p', {}, `Se muestra el histórico en lugar de «${g.label}».`));
        img.hidden = false; img.setAttribute('src', encodeURI(C.pngFor(item, 'full')));
      } }, 'Ver el histórico'));
    }
    art.append(box);
  };
}

function card(it, index) {
  const entry = it.entry;
  const src = srcOfItem(it);
  const label = `${it.label} · ${C.SEXO_LABEL[it.sexo]}`;
  const title = mode === 'all' ? `${entry.labelShort} · ${label}` : label;
  let art = null;
  const mediaBox = el('span', { class: 'g-card__media' });
  if (entry.kind === 'legacy') {
    const item = src.item(it.key);
    mediaBox.append(pngImage(item, state.grafica, '', cardImgError(() => art, item, state.grafica)));
  } else {
    mediaBox.append(el('canvas', { 'data-key': it.key, 'data-entry': entry.id, role: 'img', 'aria-label': `${entry.labelShort}, ${label}: casos observados y pronóstico` }));
  }
  const open = el('button', { type: 'button', class: 'g-card__open', 'aria-haspopup': 'dialog', 'aria-label': `Abrir ${title} en el visor`, onclick: (e) => openViewer(index, e.currentTarget) },
    mediaBox, el('span', { class: 'g-card__title' }, title));
  const extra = entry.kind === 'release' ? el('a', { class: 'g-card__link', href: C.fichaHref(entry, it.key) }, 'Ficha de la serie') : null;
  art = el('article', { class: `g-card g-card--${entry.kind}` }, open,
    el('p', { class: 'g-card__tags' }, el('span', { class: 'g-tag' }, C.NIVEL_LABEL[{ nacional: 'nacional', estado: 'estatal', region: 'regional' }[it.tipo]]), el('span', { class: 'g-tag' }, C.SEXO_LABEL[it.sexo]), extra));
  return el('li', {}, art);
}

function renderRegionNote(items) {
  const box = $('gRegionNote');
  const regions = [...new Map(items.filter((it) => it.tipo === 'region').map((it) => [`${it.entry.id}|${it.slug}`, it])).values()];
  box.replaceChildren(...regions.map((it) => {
    if (it.entry.kind === 'legacy') {
      const meta = REGION_META[srcOfItem(it).item(it.key)?.n];
      if (!meta) return null;
      return el('div', { class: 'g-region' }, el('h3', {}, it.label), el('p', {}, meta.desc),
        el('p', { class: 'g-region__states' }, `Entidades que conforman esta región: ${meta.estados.join(', ')}.`));
    }
    return el('div', { class: 'g-region' }, el('h3', {}, `${it.label} · ${it.entry.labelShort}`),
      el('p', {}, `Macrorregión del catálogo geográfico con el que se agrega ${it.entry.labelShort} (suma de sus estados); no coincide con las regiones de la cohorte neuro.`));
  }).filter(Boolean));
  box.hidden = !box.childElementCount;
}

function renderList() {
  if (mode === 'detail' && !source) { clearResults(); return; } // cargando o con error: nunca «0 resultados»
  if (mode === 'all' && !allSources.size) { clearResults(); return; }
  list = currentList();
  const pg = C.pageOf(list, page);
  page = pg.page;
  if (io) for (const c of $('gCards').querySelectorAll('canvas')) io.unobserve(c);
  pool.clear();
  $('gCards').replaceChildren(...pg.items.map((it, i) => card(it, (pg.page - 1) * C.PAGE_SIZE + i)));
  $('gCardsEmpty').hidden = list.length > 0;
  $('gLegend').hidden = !list.length;
  $('gResultCount').textContent = list.length
    ? `${NF.format(list.length)} ${list.length === 1 ? 'gráfica' : 'gráficas'} · ${C.GRAFICAS.find((g) => g.id === state.grafica).label}`
    : '';
  $('gPager').hidden = pg.pages <= 1;
  $('gPageInfo').textContent = `Página ${pg.page} de ${pg.pages}`;
  $('gPrev').disabled = pg.page <= 1;
  $('gNext').disabled = pg.page >= pg.pages;
  renderRegionNote(pg.items);
  for (const c of $('gCards').querySelectorAll('canvas')) { if (io) io.observe(c); else pool.request(c); }
}

// ── Gráficas vivas ───────────────────────────────────────────────────────────
const chartReady = () => typeof window.Chart === 'function';
const mes = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-MX', { month: 'short', year: '2-digit', timeZone: 'UTC' });
// Etiquetas ISO completas; el mes sólo en las marcas del eje, la semana exacta en el tooltip.
const xTicks = (extra = {}) => ({ color: token('--muted', '#5b6f66'), maxRotation: 0, ...extra, callback(v) { return mes(this.getLabelForValue(v)); } });
const tooltipTitle = (items) => (items.length ? C.fechaSemana(items[0].label) : '');

function drawCardChart(canvas) {
  const src = mode === 'all' ? allSources.get(canvas.dataset.entry) : source;
  const s = src?.item(canvas.dataset.key);
  if (!s) return null;
  if (!chartReady()) { canvas.replaceWith(el('span', { class: 'g-card__fallback' }, 'Gráfica no disponible: no cargó la librería de gráficas.')); return null; }
  const w = C.ventana(s, state.grafica);
  return new window.Chart(canvas, {
    type: 'line',
    data: { labels: w.d, datasets: [
      { label: 'Observado', data: w.r, borderColor: obsColor(), borderWidth: 1.6, pointRadius: 0, tension: 0, spanGaps: false },
      { label: 'Pronóstico', data: w.y, borderColor: colorOf(src.entry), borderDash: [6, 4], borderWidth: 1.8, pointRadius: 0, tension: 0, spanGaps: false },
    ] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false, events: [],
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { ticks: xTicks({ maxTicksLimit: 4 }), grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: token('--muted', '#5b6f66'), maxTicksLimit: 4 }, grid: { color: token('--line', '#dbe3dc') } },
      },
    },
  });
}

// ── Visor (dialog) ───────────────────────────────────────────────────────────
let viewerIndex = 0;
let viewerOpener = null;
let viewerChart = null;

function destroyViewerChart() { if (viewerChart) { viewerChart.destroy(); viewerChart = null; } }

function viewerState(text, actions = []) {
  const box = $('gViewerState');
  box.replaceChildren(...(text ? [text, ...actions] : []));
  box.hidden = !text;
}

/** Deja el escenario vacío antes de mostrar otra serie: nada de la anterior queda visible. */
function clearStage() {
  destroyViewerChart();
  const img = $('gViewerImg');
  img.hidden = true;
  img.removeAttribute('src');
  $('gViewerChartWrap').hidden = true;
  viewerState('');
}

function showViewerImg(item, grafica, alt, tok) {
  const img = $('gViewerImg');
  const g = C.GRAFICAS.find((x) => x.id === grafica);
  img.alt = alt;
  img.onerror = () => {
    if (!viewerLatest.isCurrent(tok)) return;
    img.hidden = true;
    const actions = [el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => showViewerImg(item, grafica, alt, tok) }, 'Reintentar')];
    if (grafica !== 'full') actions.push(el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { viewerState(`Se muestra el histórico en lugar de «${g.label}».`); showViewerImg(item, 'full', alt, tok); } }, 'Ver el histórico'));
    viewerState(`No se pudo cargar la lámina «${g.label}». `, actions);
  };
  img.onload = () => { if (viewerLatest.isCurrent(tok)) img.hidden = false; };
  img.removeAttribute('src');
  img.setAttribute('src', encodeURI(C.pngFor(item, grafica)));
  img.hidden = false;
}

function showViewerChart(s, entry, titulo) {
  $('gViewerChartWrap').hidden = false;
  destroyViewerChart();
  if (!chartReady()) { viewerState('No se pudo cargar la librería de gráficas.'); return; }
  const color = colorOf(entry);
  const banda = C.bandaPermitida(s);
  const lastReal = s.r.reduce((acc, v, i) => (v != null ? i : acc), -1);
  const corte = s.ds_corte;
  const yPron = corte ? s.y.map((v, i) => (s.d[i] > corte ? v : null)) : s.y;
  const yAjuste = corte ? s.y.map((v, i) => (s.d[i] <= corte ? v : null)) : null;
  const tieneAjuste = Array.isArray(yAjuste) && yAjuste.some((v) => v != null);
  $('gViewerChart').setAttribute('aria-label', `${titulo}: casos notificados por semana, observado y pronóstico${banda ? ' con el intervalo que produce el motor' : ''}.`);
  viewerChart = new window.Chart($('gViewerChart'), {
    type: 'line',
    data: { labels: s.d, datasets: [
      ...(banda ? [
        { label: 'Intervalo del motor (superior)', data: s.hi, borderColor: 'transparent', backgroundColor: C.withAlpha(color, 0.15), pointRadius: 0, fill: '+1', tension: 0, order: 4 },
        { label: 'Intervalo del motor (inferior)', data: s.lo, borderColor: 'transparent', backgroundColor: 'transparent', pointRadius: 0, fill: false, tension: 0, order: 4 },
      ] : []),
      { label: corte ? 'Pronóstico desde el corte' : 'Pronóstico', data: yPron, borderColor: color, borderDash: [7, 4], borderWidth: 2.4, pointRadius: 0, tension: 0, order: 2 },
      ...(tieneAjuste ? [{ label: 'Ajuste antes del corte (no es validación)', data: yAjuste, borderColor: C.withAlpha(color, 0.5), borderDash: [2, 4], borderWidth: 1.4, pointRadius: 0, tension: 0, order: 3 }] : []),
      { label: 'Observado (boletín SINAVE)', data: s.r, borderColor: obsColor(), backgroundColor: obsColor(), borderWidth: 2.4, tension: 0, order: 1,
        pointRadius: s.r.map((v, i) => (i === lastReal ? 4 : 0)) },
    ] },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: token('--ink', '#173c33'), filter: (it) => it.text !== 'Intervalo del motor (inferior)', usePointStyle: true, boxWidth: 8 } },
        tooltip: { filter: (it) => it.dataset.label !== 'Intervalo del motor (inferior)',
          callbacks: { title: tooltipTitle, label: (it) => `${it.dataset.label}: ${C.fmtCasos(it.parsed.y)} casos` } },
      },
      scales: {
        x: { ticks: xTicks({ autoSkip: true, maxTicksLimit: 10 }), grid: { color: token('--line', '#dbe3dc') } },
        y: { beginAtZero: true, ticks: { color: token('--muted', '#5b6f66') }, grid: { color: token('--line', '#dbe3dc') }, title: { display: true, text: 'Casos por semana', color: token('--muted', '#5b6f66') } },
      },
    },
  });
}

function openViewer(index, from) {
  const dlg = $('gViewer');
  if (!dlg.open) viewerOpener = from ?? document.activeElement;
  viewerIndex = (index + list.length) % list.length;
  const it = list[viewerIndex];
  const entry = it.entry;
  const src = srcOfItem(it);
  const g = C.GRAFICAS.find((x) => x.id === state.grafica);
  const titulo = `${entry.labelShort} · ${it.label} · ${C.SEXO_LABEL[it.sexo]}`;
  const tok = viewerLatest.next();
  clearStage();
  $('gViewerTitle').textContent = titulo;
  $('gViewerPos').textContent = `${viewerIndex + 1} de ${list.length}`;
  const f = C.entryFacts(entry);
  const links = [el('a', { class: 'text-link', href: C.dashboardHref({ p: entry.id, s: it.sexo, t: it.slug }) }, 'Ver en el Dashboard')];
  if (entry.kind === 'legacy') {
    const item = src.item(it.key);
    links.unshift(el('a', { class: 'text-link', href: encodeURI(C.pngFor(item, state.grafica)) }, 'Abrir la lámina PNG'));
    links.push(el('a', { class: 'text-link', href: `../${entry.page}` }, 'Método'));
    $('gViewerMeta').textContent = `${g.label} · ${f.origen} · último observado: ${f.observado}`;
    if (state.grafica === 'zoom') {
      viewerState('Cargando la gráfica…');
      load(`../${COHORTS[entry.cohort]}`, (z) => { if (!z || typeof z !== 'object') throw new Error('archivo de cohorte inválido'); return z; }, 'cohorte').then((zoom) => {
        if (!viewerLatest.isCurrent(tok)) return;
        const s = zoom[item.f];
        viewerState('');
        if (s && Array.isArray(s.d) && s.d.length) {
          $('gViewerMeta').textContent = `${g.label} · motor ${s.motor} · ${f.origen} · ${C.bandaPermitida(s) ? 'con el intervalo que produce el motor' : 'sin intervalo'}`;
          showViewerChart(s, entry, titulo);
        } else showViewerImg(item, 'zoom', titulo, tok);
      }).catch((err) => {
        if (!viewerLatest.isCurrent(tok)) return;
        logError('archivo de la cohorte', err);
        viewerState('No se pudo cargar la gráfica interactiva; se muestra la lámina del mismo zoom.');
        showViewerImg(item, 'zoom', titulo, tok);
      });
    } else showViewerImg(item, state.grafica, `${titulo} · ${g.label}`, tok);
  } else {
    const s = src.item(it.key);
    links.push(el('a', { class: 'text-link', href: C.fichaHref(entry, it.key) }, 'Ficha de la serie y método'));
    $('gViewerMeta').textContent = `${g.label} · ${s.motor === 'portfolio' ? 'derivado del portafolio' : `motor ${s.motor}`} · ${f.origen} · pronóstico puntual, sin intervalos`;
    showViewerChart(C.ventana(s, state.grafica), entry, titulo);
  }
  $('gViewerLinks').replaceChildren(...links);
  if (!dlg.open) dlg.showModal();
  $('gViewerClose').focus();
}

function bindViewer() {
  const dlg = $('gViewer');
  $('gViewerClose').addEventListener('click', () => dlg.close());
  $('gViewerPrev').addEventListener('click', () => openViewer(viewerIndex - 1));
  $('gViewerNext').addEventListener('click', () => openViewer(viewerIndex + 1));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); openViewer(viewerIndex - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); openViewer(viewerIndex + 1); }
  });
  dlg.addEventListener('close', () => {
    viewerLatest.next();
    clearStage();
    const back = viewerOpener && viewerOpener.isConnected ? viewerOpener : $('gResultCount');
    viewerOpener = null;
    back?.focus?.();
  });
}

// ── Lista completa (acción explícita, con propiedad de corrida) ──────────────
function allStatusText(res, total) {
  const ok = res.ok.size, fail = res.errors.size, pending = total - ok - fail;
  const parts = [`${ok} de ${total} padecimientos cargados`];
  if (fail) parts.push(`${fail} con error`);
  if (pending) parts.push(`${pending} sin cargar por cancelación`);
  return `${parts.join(' · ')}.`;
}

async function loadAllSeries() {
  leaveAll();
  mode = 'all';
  state = { p: null, ...C.DEFAULT_DETAIL, t: '', nivel: 'todos', s: 'general' };
  const run = { id: ++allRunSeq, abort: new AbortController() };
  allRun = run;
  const own = () => allRun === run && mode === 'all';
  $('gAllLoad').disabled = true;
  $('gAllCancel').hidden = false;
  $('gAllProgress').hidden = false;
  $('gAllErrors').replaceChildren();
  const entries = catalog.diseases;
  const bar = $('gAllBar');
  bar.max = entries.length;
  bar.value = 0;
  const res = await C.loadAll(entries, loadSource, {
    concurrency: 3, signal: run.abort.signal,
    onProgress: ({ done, total, id, error }) => {
      if (!own()) return; // corrida abandonada: no toca la página
      bar.value = done;
      $('gAllStatus').textContent = `${done} de ${total} padecimientos procesados`;
      if (error) {
        logError(`fuente de ${id}`, error);
        const e = entries.find((x) => x.id === id);
        $('gAllErrors').append(el('li', { 'data-p': id }, `${e.labelShort}: no se pudo cargar. `,
          el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: (ev) => retryOne(e, ev.currentTarget.closest('li'), run) }, 'Reintentar')));
      }
    },
  });
  if (!own()) return; // se navegó a otra selección o se salió: nada se promueve
  allSources = res.ok;
  $('gAllLoad').disabled = false;
  $('gAllCancel').hidden = true;
  $('gAllStatus').textContent = res.cancelled ? `Cancelado: lista parcial. ${allStatusText(res, entries.length)}` : allStatusText(res, entries.length);
  showAllDetail(res);
}

function retryOne(entry, li, run) {
  li.firstChild.textContent = `${entry.labelShort}: reintentando… `;
  loadSource(entry).then((src) => {
    if (allRun !== run || mode !== 'all') return;
    allSources.set(entry.id, src);
    li.remove();
    renderList();
    $('gAllStatus').textContent = `${entry.labelShort} se añadió a la lista.`;
  }).catch((err) => {
    logError(`fuente de ${entry.id}`, err);
    if (allRun === run) li.firstChild.textContent = `${entry.labelShort}: no se pudo cargar. `;
  });
}

function showAllDetail(res) {
  $('gCatalog').hidden = false;
  $('gDetail').hidden = false;
  $('gDetailKicker').textContent = 'Todos los padecimientos';
  $('gDetailTitle').textContent = 'Todas las series';
  $('gDetailStatus').textContent = 'Cada tarjeta conserva el estado y el corte de su padecimiento; ábrela para ver sus datos.';
  $('gDetailLinks').replaceChildren();
  $('gFacts').replaceChildren();
  $('gDetailLoading').hidden = true;
  $('gDetailError').hidden = true;
  renderControls({ kind: 'all', sexes: ['general', 'hombres', 'mujeres'] });
  setFiltersEnabled(true);
  $('gTerritorio').disabled = true;
  if (!res.ok.size) {
    clearResults();
    $('gDetailError').hidden = false;
    $('gDetailErrorMsg').textContent = res.cancelled
      ? 'Cancelaste la carga antes de que llegara algún padecimiento. Vuelve a cargar la lista cuando quieras.'
      : `${humanError('ningún padecimiento')} Usa «Reintentar» en cada uno o vuelve a cargar la lista.`;
    return;
  }
  page = 1;
  renderList();
  $('gDetail').scrollIntoView?.();
  $('gDetailTitle').focus({ preventScroll: true });
}

// ── Eventos ──────────────────────────────────────────────────────────────────
function bind() {
  $('gSearch').addEventListener('input', () => { if (catalog) renderCatalog(); });
  $('gStatus').addEventListener('change', () => { if (catalog) renderCatalog(); });
  $('gCatalogRetry').addEventListener('click', start);
  $('gDetailRetry').addEventListener('click', () => {
    if (mode === 'all') loadAllSeries();
    else loadDetail(catalog.diseases.find((d) => d.id === state.p));
  });
  $('gBack').addEventListener('click', backToCatalog);
  $('gAllLoad').addEventListener('click', loadAllSeries);
  $('gAllCancel').addEventListener('click', () => { if (allRun) allRun.abort.abort(); }); // conserva lo cargado
  $('gNivel').addEventListener('change', () => {
    state.nivel = $('gNivel').value;
    state.t = mode === 'detail' && state.nivel === 'nacional' ? 'nacional' : '';
    if (source && mode === 'detail') $('gTerritorio').value = state.t;
    page = 1; if (mode === 'detail') writeUrl(false); renderList();
  });
  $('gTerritorio').addEventListener('change', () => {
    state.t = $('gTerritorio').value;
    if (state.t) $('gNivel').value = nivelOfT(); else state.nivel = $('gNivel').value;
    page = 1; writeUrl(false); renderList();
  });
  $('gSexo').addEventListener('change', () => { state.s = $('gSexo').value; page = 1; if (mode === 'detail') writeUrl(false); renderList(); });
  $('gQ').addEventListener('input', () => { page = 1; renderList(); });
  $('gPrev').addEventListener('click', () => { page -= 1; renderList(); $('gResultCount').focus(); });
  $('gNext').addEventListener('click', () => { page += 1; renderList(); $('gResultCount').focus(); });
  $('gResultCount').setAttribute('tabindex', '-1');
  window.addEventListener('popstate', () => {
    if (!catalog) return;
    // «Atrás» con el visor abierto: se cierra ANTES de cambiar de fuente (su lista dejaría de existir).
    if ($('gViewer').open) $('gViewer').close();
    leaveAll();
    readUrlAndRoute();
  });
  bindViewer();
}

async function start() {
  $('gCatalogError').hidden = true;
  $('gCatalogLoading').hidden = false;
  try {
    await ensureCatalog();
  } catch (err) {
    logError('catálogo', err);
    $('gCatalogLoading').hidden = true;
    $('gCatalogError').hidden = false;
    $('gCatalogErrorMsg').textContent = humanError('el catálogo de padecimientos');
    $('gSummary').textContent = 'Catálogo no disponible.';
    return;
  }
  $('gCatalogLoading').hidden = true;
  renderSummary();
  renderCatalog();
  readUrlAndRoute();
}

bind();
start();
