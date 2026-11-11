// dashboard.mjs: controlador del dashboard. Toda la lógica de datos vive en data.mjs.
// Seguridad: el DOM se construye sólo con createElement/createElementNS y nodos de texto;
// ningún dato se interpreta como marcado. Los anchos de barras usan CSSOM (element.style),
// que la CSP sin 'unsafe-inline' permite.
import {
  COHORTS, MAP_URL, TABLEAU_ARCHIVE_URL, FASES, SEXOS, VENTANAS, METRICAS, PAGE_SIZES,
  padecimientoById, buildIndex, resolveTerritory, getSeries, buildRows, applyWindow,
  computeKpis, motorDistribution, rankEstados, quantileThresholds, bucketOf, niceTicks,
  formatInt, formatValue, formatDate, formatMonth, formatWeek, toCSV, csvFilename,
  parseState, serializeState, normalizeMap, createCachedLoader, createLatest,
  filterByFase, paginate,
} from './data.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
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

// ── Estado ──────────────────────────────────────────────────────────────────
const load = createCachedLoader((url, init) => fetch(url, init));
const latest = createLatest();
let state = parseState(location.search);
const indexCache = new Map(); // padecimiento → índice
let view = null; // selección vigente; null mientras carga o tras un fallo
let cursor = null; // índice de la semana inspeccionada dentro de view.windowRows
let cursorDate = null; // fecha inspeccionada; sobrevive a cambios de ventana o serie
let mapModel = null;
let mapReady = null; // promesa única de construcción del mapa
const table = { fase: 'todas', page: 1, size: PAGE_SIZES[0] };

// ── Arranque ────────────────────────────────────────────────────────────────
function init() {
  bindControls();
  setupArchive();
  window.addEventListener('popstate', () => {
    state = parseState(location.search);
    $('tabs').hidden = !state.archivo;
    if (!state.archivo) {
      $('panel-tablero').hidden = false;
      $('panel-archivo').hidden = true;
      $('tab-tablero').setAttribute('aria-selected', 'true');
      $('tab-archivo').setAttribute('aria-selected', 'false');
      $('tab-tablero').tabIndex = 0;
      $('tab-archivo').tabIndex = -1;
      clear($('archivo-frame'));
      $('cargar-archivo').disabled = false;
      $('cargar-archivo').textContent = 'Cargar el archivo histórico';
    }
    refresh();
  });
  let resizeTimer = 0;
  let lastWidth = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const w = $('grafico').getBoundingClientRect().width;
      if (Math.abs(w - lastWidth) < 24 || !view?.windowRows) return;
      lastWidth = w;
      renderChart();
    }, 150);
  });
  refresh();
}

/** Refleja el estado en los controles (también al volver con el historial). */
function syncControls() {
  for (const input of document.querySelectorAll('#filtros input[type=radio]')) {
    input.checked = state[input.name] === input.value;
  }
  $('f-ventana').value = state.v;
  $('f-metrica').value = state.m;
  const terr = $('f-territorio');
  if ([...terr.options].some((o) => o.value === state.t)) terr.value = state.t;
}

function bindControls() {
  $('filtros').addEventListener('change', (ev) => {
    const t = ev.target;
    if (['p', 's', 't', 'v'].includes(t.name)) update({ [t.name]: t.value });
  });
  $('filtros').addEventListener('submit', (ev) => ev.preventDefault());
  $('f-metrica').addEventListener('change', (ev) => update({ m: ev.target.value }));
  $('reintentar').addEventListener('click', () => refresh());
  $('descargar-csv').addEventListener('click', downloadCsv);
  $('copiar-enlace').addEventListener('click', copyLink);
  $('f-fase').addEventListener('change', (ev) => { table.fase = ev.target.value; table.page = 1; renderTable(); });
  $('f-filas').addEventListener('change', (ev) => { table.size = Number(ev.target.value); table.page = 1; renderTable(); });
  const go = (fn) => (ev) => {
    if (!view?.windowRows) return;
    table.page = fn(table.page);
    renderTable(ev.currentTarget);
  };
  $('pag-primera').addEventListener('click', go(() => 1));
  $('pag-anterior').addEventListener('click', go((p) => p - 1));
  $('pag-siguiente').addEventListener('click', go((p) => p + 1));
  $('pag-ultima').addEventListener('click', go(() => Infinity));
  bindChart();
}

/** p, s, t y v recargan la selección; m sólo afecta al mapa y al ranking. */
function update(patch) {
  const onlyMeasure = Object.keys(patch).every((k) => k === 'm');
  state = { ...state, ...patch };
  history.pushState(null, '', serializeState(state));
  if (onlyMeasure && view) {
    renderRanking();
    renderMap(view.token);
    return;
  }
  refresh();
}

function replaceUrl() {
  const next = serializeState(state);
  if (location.search !== next) history.replaceState(null, '', next);
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(location.href);
    announce('Enlace de la selección copiado.');
  } catch {
    announce('No se pudo copiar; el enlace de la barra de direcciones conserva la selección.');
  }
}

function announce(msg) { $('estado').textContent = msg; }

// ── Ciclo de carga ──────────────────────────────────────────────────────────
/** Mientras carga o tras un fallo no se muestra ningún dato previo. Los filtros siguen activos. */
function setPhase(phase, message = '') {
  $('dash').hidden = phase !== 'ready';
  $('cargando').hidden = phase !== 'loading';
  $('error').hidden = phase !== 'error';
  if (phase === 'loading') $('cargando-msg').textContent = message;
  if (phase === 'error') $('error-msg').textContent = message;
  if (phase !== 'ready') {
    view = null;
    $('descargar-csv').disabled = true;
    for (const id of ['em-corte', 'em-real', 'em-boletin']) $(id).textContent = phase === 'error' ? 'sin dato' : 'Cargando…';
  }
}

async function refresh() {
  const token = latest.next();
  const pad = padecimientoById(state.p);
  syncControls();
  setPhase('loading', `Cargando las series de ${pad.label}…`);
  announce(`Cargando ${pad.label}…`);

  let raw;
  try {
    raw = await load(COHORTS[pad.cohort]);
  } catch (err) {
    if (!latest.isCurrent(token)) return;
    setPhase('error', `No se pudieron cargar las series de ${pad.label} (${err.message}). Revisa tu conexión y reintenta, o cambia la selección.`);
    announce('');
    return;
  }
  if (!latest.isCurrent(token)) return; // otra selección ganó la carrera

  if (!indexCache.has(pad.id)) indexCache.set(pad.id, buildIndex(raw, pad.id));
  const index = indexCache.get(pad.id);
  const { t, fallback } = resolveTerritory(index, state.t);
  const requested = state.t;
  state.t = t ?? 'nacional';
  replaceUrl();
  populateTerritories(index);

  const series = t ? getSeries(raw, index, t, state.s) : null;
  const entity = index.entities.get(t);
  const sexo = SEXOS.find((x) => x.id === state.s);
  view = { pad, index, raw, series, entity, sexo, token };
  table.page = 1;

  // Revelar antes de dibujar: el gráfico mide su ancho real.
  setPhase('ready');
  renderEmission(series ?? getSeries(raw, index, 'nacional', 'general'));

  if (!series) {
    renderEmpty(pad, entity, sexo);
  } else {
    const allRows = buildRows(series);
    const windowRows = applyWindow(allRows, state.v, series);
    Object.assign(view, { allRows, windowRows, kpis: computeKpis(series, allRows, windowRows) });
    renderSelection();
    renderKpis();
    renderChart();
    renderTable();
  }
  renderMotores();
  renderRanking();
  renderMap(token);

  announce(fallback
    ? `${pad.label} no tiene serie para el territorio solicitado («${requested}»); se muestra ${entity?.label ?? 'el primer territorio disponible'}.`
    : `${pad.label} · ${entity?.label ?? 'sin territorio'} · ${sexo.label}: listo.`);
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

// ── Emisión, selección y KPIs ───────────────────────────────────────────────
function renderEmission(s) {
  $('em-corte').textContent = s ? formatWeek(s.corteModelo) : 'sin dato';
  $('em-real').textContent = s ? formatDate(s.lastReal) : 'sin dato';
  $('em-boletin').textContent = s ? formatWeek(s.ultimaSemanaBoletin) : 'sin dato';
}

function renderSelection() {
  const { pad, entity, sexo, series } = view;
  const title = `${pad.label} · ${entity.label} · ${sexo.label}`;
  $('sel-titulo').textContent = title;
  document.title = `${title} · Dashboard epidemiológico · EpiForecast-MX`;
  $('enlace-metodologia').setAttribute('href', pad.metodologia);
  const dl = $('sel-meta');
  clear(dl);
  for (const [k, v] of [
    ['Motor asignado', series.motor],
    ['Corte del modelo', formatWeek(series.corteModelo)],
    ['Último boletín observado', formatWeek(series.ultimaSemanaBoletin)],
  ]) dl.append(el('div', {}, el('dt', {}, k), el('dd', {}, v)));
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
  const text = state.s === 'general'
    ? `${n} ${n === 1 ? 'semana con valor negativo' : 'semanas con valor negativo'} en la fuente; se muestra sin recortar.`
    : `${n} ${n === 1 ? 'semana con incremento neto negativo' : 'semanas con incremento neto negativo'} (revisión del acumulado); sin recortar.`;
  return el('p', { class: 'kpi__sub kpi__sub--rev' }, text);
}

function renderKpis() {
  const { kpis: k, series } = view;
  const box = $('kpis');
  clear(box);
  const p = k.pronostico;
  box.append(kpiCard({
    tone: 'blue',
    label: 'Total pronosticado tras el corte',
    value: formatInt(p.sum),
    unit: 'casos',
    lines: [
      `${p.n} pasos semanales con valor, ${spanText(p)}.`,
      p.nNull ? `${p.nNull} semanas sin dato.` : null,
      'Suma de los valores semanales redondeados de la serie visual; puede diferir del resumen productivo.',
    ],
  }));

  const o = k.observadoVentana;
  box.append(kpiCard({
    tone: 'green',
    label: 'Observado en la ventana',
    value: formatInt(o.sum),
    unit: 'casos',
    lines: [
      `${o.n} semanas con dato, ${spanText(o)}.`,
      o.nNull ? `${o.nNull} semanas sin dato.` : null,
      negativeNote(o.negatives),
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
        : `El último índice observado (${formatDate(series.lastReal)}) no rebasa el índice del corte.`,
      'Comparación descriptiva; no es una medida de precisión.',
    ],
  }));

  const f = k.pendiente;
  box.append(kpiCard({
    tone: 'gold',
    label: 'Pronóstico aún no observado',
    value: formatInt(f.sum),
    unit: 'casos',
    lines: [`${f.n} semanas posteriores a la última observación, ${spanText(f)}.`],
  }));
}

function renderEmpty(pad, entity, sexo) {
  $('sel-titulo').textContent = `${pad.label} · ${entity?.label ?? 'sin territorio'} · ${sexo.label}`;
  clear($('sel-meta'));
  const box = $('kpis');
  clear(box);
  box.append(el('p', { class: 'empty-inline' }, 'No hay una serie publicada para esta combinación. Elige otro sexo o territorio.'));
  clear($('grafico'));
  clear($('graf-marcas'));
  $('graf-vacio').hidden = false;
  $('graf-vacio').textContent = 'Sin serie para la selección.';
  clear($('readout'));
  $('chart').setAttribute('aria-valuemax', '1');
  $('chart').setAttribute('aria-valuetext', 'Sin datos');
  clear($('tabla-cuerpo'));
  $('pag-estado').textContent = '';
  for (const id of ['pag-primera', 'pag-anterior', 'pag-siguiente', 'pag-ultima']) $(id).disabled = true;
  $('descargar-csv').disabled = true;
  $('descargar-csv').textContent = 'Descargar CSV';
}

// ── Gráfico ─────────────────────────────────────────────────────────────────
const G = { w: 960, h: 360, l: 58, r: 18, t: 34, b: 36, fs: 11, k: 1 };

/** El viewBox se escala con el ancho; compensamos tipografía y márgenes para pantallas angostas. */
function fitGeometry(svg, tickLabels) {
  const width = svg.getBoundingClientRect().width || G.w;
  G.h = width < 500 ? 600 : 360;
  svg.setAttribute('viewBox', `0 0 ${G.w} ${G.h}`);
  G.k = Math.min(2.6, Math.max(1, G.w / width));
  G.fs = 11 * G.k;
  G.wide = G.k <= 1.35; // con espacio, las marcas llevan su rótulo dentro del gráfico
  G.t = G.wide ? 22 + 12 * G.k : 12;
  G.b = 18 + 16 * G.k;
  const longest = Math.max(1, ...tickLabels.map((s) => s.length));
  G.l = 14 + longest * G.fs * 0.6;
}

function renderChart() {
  const svg = $('grafico');
  clear(svg);
  $('graf-vacio').hidden = true;
  const rows = view.windowRows;
  const { series } = view;
  const chart = $('chart');

  // Claves de las marcas, siempre legibles fuera del SVG.
  const marks = $('graf-marcas');
  clear(marks);
  if (series.dsCorte) marks.append(el('span', { class: 'mk-key' }, `Índice del corte: ${formatDate(series.dsCorte)}`));
  if (series.lastReal) marks.append(el('span', { class: 'mk-key mk-key--real' }, `Último índice observado: ${formatDate(series.lastReal)}`));

  if (!rows.length) {
    $('graf-vacio').hidden = false;
    $('graf-vacio').textContent = 'La ventana elegida no contiene semanas.';
    chart.setAttribute('aria-valuemax', '1');
    clear($('readout'));
    view.geom = null;
    return;
  }

  const values = rows.flatMap((r) => [r.real, r.pron]).filter((v) => v !== null);
  const lo = values.length ? Math.min(0, ...values) : 0;
  const hi = values.length ? Math.max(...values) : 1;
  const ticks = niceTicks(lo, hi, 5);
  fitGeometry(svg, ticks.map(formatValue));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const iw = G.w - G.l - G.r, ih = G.h - G.t - G.b;
  const n = rows.length;
  const x = (i) => G.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v) => G.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
  view.geom = { x, y, n, iw, ih };

  // Bandas de fase
  const iVer = rows.findIndex((r) => r.fase !== 'observado');
  const iFut = rows.findIndex((r) => r.fase === 'futuro');
  const half = n > 1 ? iw / (n - 1) / 2 : 0;
  const edge = (i) => (i <= 0 ? G.l : x(i) - half);
  const bands = sv('g', { class: 'bands' });
  if (iVer >= 0) bands.append(sv('rect', { class: 'band band--ver', x: edge(iVer), y: G.t, width: G.w - G.r - edge(iVer), height: ih }));
  if (iFut >= 0) bands.append(sv('rect', { class: 'band band--fut', x: edge(iFut), y: G.t, width: G.w - G.r - edge(iFut), height: ih }));
  svg.append(bands);

  // Rejilla y eje Y
  const grid = sv('g', { class: 'grid' });
  for (const t of ticks) {
    grid.append(sv('line', { x1: G.l, x2: G.w - G.r, y1: y(t), y2: y(t), class: t === 0 ? 'zero' : null }));
    grid.append(sv('text', { x: G.l - 8, y: y(t), class: 'tick', 'font-size': G.fs, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, formatValue(t)));
  }
  // Eje X: primera semana de cada mes, con separación mínima medida en unidades del viewBox.
  const labelW = G.fs * 3.8; // «sept 26» ≈ 6 a 7 caracteres
  const stepPx = n > 1 ? iw / (n - 1) : iw;
  const minGap = Math.max(1, Math.ceil((labelW + 10 * G.k) / stepPx));
  let lastLabeled = -Infinity;
  rows.forEach((r, i) => {
    const monthStart = i === 0 || r.date.slice(0, 7) !== rows[i - 1].date.slice(0, 7);
    if (!monthStart || i - lastLabeled < minGap) return;
    if (x(i) + labelW / 2 > G.w || x(i) - labelW / 2 < G.l - labelW * 0.6) return;
    lastLabeled = i;
    grid.append(sv('line', { class: 'xtick', x1: x(i), x2: x(i), y1: G.t + ih, y2: G.t + ih + 4 }));
    grid.append(sv('text', { x: x(i), y: G.t + ih + 8 + G.fs, class: 'tick', 'font-size': G.fs, 'text-anchor': 'middle' }, formatMonth(r.date)));
  });
  svg.append(grid);

  // Marcas verticales; en pantallas amplias llevan rótulo, en angostas la clave va arriba del gráfico.
  const markers = sv('g', { class: 'markers' });
  if (iVer > 0) {
    const xc = edge(iVer);
    markers.append(sv('line', { class: 'mk mk--corte', x1: xc, x2: xc, y1: G.t - (G.wide ? 6 : 0), y2: G.t + ih }));
    if (G.wide) {
      markers.append(sv('text', { class: 'mk-label mk-label--corte', 'font-size': G.fs, x: xc - 6, y: G.t - 10, 'text-anchor': xc - G.l < 200 ? 'start' : 'end' },
        `Índice del corte · ${formatDate(series.dsCorte)}`));
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

  // Series: los null cortan la línea
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
  const dVer = path('pron', (r) => r.fase === 'verificable');
  // El tramo futuro arranca en el último punto ya observado para no dejar hueco visual.
  const dFut = path('pron', (r, i) => r.fase === 'futuro' || (r.fase === 'verificable' && rows[i + 1]?.fase === 'futuro'));
  if (dVer) lines.append(sv('path', { class: 'ln ln--pron', d: dVer }));
  if (dFut) lines.append(sv('path', { class: 'ln ln--fut', d: dFut }));
  const dObs = path('real', () => true);
  if (dObs) lines.append(sv('path', { class: 'ln ln--obs', d: dObs }));
  rows.forEach((r, i) => {
    if (r.real === null) return;
    const ptR = 2.6 * Math.min(G.k, 1.8);
    if (r.real < 0) { // rosa sólo para revisiones (valores negativos)
      lines.append(sv('circle', { class: 'pt pt--rev', cx: x(i), cy: y(r.real), r: ptR + 1 }));
      return;
    }
    const isolated = (rows[i - 1]?.real ?? null) === null && (rows[i + 1]?.real ?? null) === null;
    if (isolated) lines.append(sv('circle', { class: 'pt pt--obs', cx: x(i), cy: y(r.real), r: ptR }));
  });
  svg.append(lines);

  svg.append(sv('g', { id: 'inspector', class: 'inspector' }));

  chart.setAttribute('aria-valuemax', String(n));
  const sum = view.kpis;
  $('graf-resumen').textContent =
    `Gráfico de ${n} pasos semanales; fechas del índice del ${formatDate(rows[0].date)} al ${formatDate(rows[n - 1].date)}. ` +
    `Observado en la ventana: ${formatInt(sum.observadoVentana.sum)} casos. ` +
    `Pronóstico emitido tras el corte: ${formatInt(sum.pronostico.sum)} casos en ${sum.pronostico.n} semanas. ` +
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
  return { fase, obs, pron, text: `Fecha de la serie: ${formatDate(r.date)}. ${fase}. Observado: ${obs}. Pronóstico: ${pron}.` };
}

function setCursor(i) {
  if (!view?.windowRows?.length || !view.geom) return;
  const rows = view.windowRows;
  cursor = Math.max(0, Math.min(rows.length - 1, i));
  const r = rows[cursor];
  cursorDate = r.date;
  const { x, y } = view.geom;
  const g = $('inspector');
  if (g) {
    clear(g);
    const rad = 4.5 * Math.min(G.k, 1.8);
    g.append(sv('line', { class: 'cross', x1: x(cursor), x2: x(cursor), y1: G.t, y2: G.h - G.b }));
    if (r.real !== null) g.append(sv('circle', { class: `dot ${r.real < 0 ? 'dot--rev' : 'dot--obs'}`, cx: x(cursor), cy: y(r.real), r: rad }));
    if (r.pron !== null) g.append(sv('circle', { class: `dot ${r.fase === 'futuro' ? 'dot--fut' : 'dot--pron'}`, cx: x(cursor), cy: y(r.pron), r: rad }));
  }
  const d = describeRow(r);
  const chart = $('chart');
  chart.setAttribute('aria-valuenow', String(cursor + 1));
  chart.setAttribute('aria-valuetext', d.text);
  $('readout').replaceChildren(
    el('span', { class: 'ro__date' }, `Fecha de la serie: ${formatDate(r.date)}`),
    el('span', { class: `ro__fase ro__fase--${r.fase}` }, d.fase),
    el('span', {}, 'Observado ', el('strong', { class: r.real !== null && r.real < 0 ? 'neg' : null }, d.obs)),
    el('span', {}, 'Pronóstico ', el('strong', {}, d.pron)),
  );
}

function bindChart() {
  const chart = $('chart');
  const svg = $('grafico');
  const indexFromEvent = (ev) => {
    if (!view?.geom) return null;
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * G.w;
    const { n, iw } = view.geom;
    if (n <= 1) return 0;
    return Math.round(((px - G.l) / iw) * (n - 1));
  };
  svg.addEventListener('pointermove', (ev) => {
    const i = indexFromEvent(ev);
    if (i !== null) setCursor(i);
  });
  svg.addEventListener('pointerdown', (ev) => {
    const i = indexFromEvent(ev);
    if (i !== null) { setCursor(i); chart.focus({ preventScroll: true }); }
  });
  chart.addEventListener('keydown', (ev) => {
    if (!view?.windowRows?.length || !view.geom) return;
    const n = view.windowRows.length;
    const moves = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -4, PageUp: 4 };
    let next = null;
    if (ev.key in moves) next = (cursor ?? 0) + moves[ev.key];
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = n - 1;
    if (next === null) return;
    ev.preventDefault();
    setCursor(next);
  });
}

// ── Tabla y CSV ─────────────────────────────────────────────────────────────
/** pagerButton: botón de paginación que disparó el cambio, para conservar el foco. */
function renderTable(pagerButton = null) {
  if (!view?.windowRows) return;
  $('f-fase').value = table.fase;
  $('f-filas').value = String(table.size);
  const filtered = filterByFase(view.windowRows, table.fase);
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
    frag.append(el('tr', { class: 'empty-row' }, el('td', { colspan: '4' }, 'Ninguna semana de la ventana está en esta fase.')));
  }
  $('tabla-cuerpo').replaceChildren(frag);

  const w = VENTANAS.find((v) => v.id === state.v);
  const faseLabel = table.fase === 'todas' ? 'todas las fases' : FASES[table.fase].label.toLowerCase();
  const status = pg.total
    ? `Página ${pg.page} de ${pg.pages} · semanas ${pg.start + 1} a ${pg.end} de ${pg.total} (${faseLabel})`
    : `Sin semanas (${faseLabel})`;
  $('pag-estado').textContent = status; // región viva: anuncia el cambio de página o de filtro
  $('tabla-caption').textContent = `${$('sel-titulo').textContent}. Ventana: ${w.label}. ${status}.`;
  $('pag-primera').disabled = $('pag-anterior').disabled = pg.page <= 1;
  $('pag-siguiente').disabled = $('pag-ultima').disabled = pg.page >= pg.pages;
  // Si el botón pulsado quedó deshabilitado (primera o última página), el foco no se pierde.
  if (pagerButton?.disabled) {
    const target = [$('pag-anterior'), $('pag-siguiente')].find((b) => !b.disabled);
    target?.focus();
  }

  const n = view.windowRows.length;
  const btn = $('descargar-csv');
  btn.disabled = n === 0;
  btn.textContent = `Descargar CSV (ventana completa, ${n} semanas)`;
}

function downloadCsv() {
  if (!view?.series || !view.windowRows?.length) return;
  const csv = toCSV(view.windowRows, {
    padecimiento: view.pad.label,
    territorio: view.entity.label,
    sexo: view.sexo.label,
    motor: view.series.motor,
    corteModelo: view.series.corteModelo,
    dsCorte: view.series.dsCorte,
    lastReal: view.series.lastReal,
    ultimaSemanaBoletin: view.series.ultimaSemanaBoletin,
  });
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: csvFilename(state) });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce(`CSV descargado con la ventana completa: ${view.windowRows.length} semanas.`);
}

// ── Motores ─────────────────────────────────────────────────────────────────
function renderMotores() {
  const { raw, index, pad, sexo } = view;
  const dist = motorDistribution(raw, index, state.s);
  const list = $('motores');
  clear(list);
  const parts = [];
  if (dist.byTipo.nacional) parts.push('nacional');
  if (dist.byTipo.estado) parts.push(`${dist.byTipo.estado} entidades`);
  if (dist.byTipo.region) parts.push(`${dist.byTipo.region} regiones`);
  $('mot-nota').textContent = `${pad.label}, ${sexo.label.toLowerCase()}: ${dist.total} series (${parts.join(', ')}). Cuenta asignaciones, no desempeño.`;
  const current = view.series?.motor;
  for (const item of dist.items) {
    const bar = el('span', { class: 'bar__fill' });
    bar.style.width = `${(item.share * 100).toFixed(1)}%`;
    list.append(el('li', { class: `bar${item.motor === current ? ' is-current' : ''}` },
      el('span', { class: 'bar__label' }, item.motor, item.motor === current ? el('span', { class: 'tag' }, 'esta serie') : null),
      el('span', { class: 'bar__track', 'aria-hidden': 'true' }, bar),
      el('span', { class: 'bar__value' }, `${item.n}`)));
  }
}

// ── Ranking y mapa (medida m) ───────────────────────────────────────────────
function metricNote() {
  const metric = METRICAS.find((m) => m.id === state.m);
  const w = VENTANAS.find((v) => v.id === state.v);
  const base = state.m === 'observado'
    ? `${metric.label} (${w.label.toLowerCase()})`
    : `${metric.label}: suma de los pasos posteriores al corte`;
  return `${base}; ${view.sexo.label.toLowerCase()}. Conteos absolutos, sin ajuste por población.`;
}

function renderRanking() {
  const { raw, index } = view;
  const ranking = rankEstados(raw, index, state.s, state.m, state.v);
  view.ranking = ranking;
  $('rank-nota').textContent = metricNote();
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
    btn.addEventListener('click', () => selectTerritory(item.slug));
    frag.append(el('li', {}, btn));
  }
  $('ranking').replaceChildren(frag);
}

function selectTerritory(slug) {
  if (slug === state.t) return;
  update({ t: slug });
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
    retry.addEventListener('click', () => { if (view) renderMap(view.token); });
    status.hidden = false;
    status.replaceChildren(el('span', {}, `No se pudo cargar el mapa (${err.message}). El ranking sigue disponible.`), retry);
    return;
  }
  if (!latest.isCurrent(token) || !view?.ranking) return; // una selección más reciente pintará el mapa
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
  const byslug = new Map(view.ranking.map((r) => [r.slug, r]));
  const thresholds = quantileThresholds(view.ranking.map((r) => r.value), 5);
  for (const path of $('mapa').querySelectorAll('path.st')) {
    const item = byslug.get(path.getAttribute('data-slug'));
    if (!item) continue;
    const b = bucketOf(item.value, thresholds);
    path.setAttribute('class', `st ${b === null ? 'st--nd' : `st--b${b}`}${item.slug === state.t ? ' is-selected' : ''}`);
    const label = `${item.label}: ${formatInt(item.value)}${item.rank ? `, lugar ${item.rank} de 32` : ''}`;
    path.setAttribute('aria-label', `${label}. Ver su serie.`);
    path.setAttribute('aria-pressed', String(item.slug === state.t));
    path.firstChild.textContent = label;
  }
  const legend = $('mapa-leyenda');
  clear(legend);
  const vals = view.ranking.map((r) => r.value).filter((v) => v !== null);
  if (!vals.length) { legend.append(el('li', {}, 'Sin valores para colorear.')); return; }
  const bounds = [Math.min(...vals), ...thresholds, Math.max(...vals)];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    legend.append(el('li', {}, el('span', { class: `sw st--b${i}`, 'aria-hidden': 'true' }),
      bounds[i] === bounds[i + 1] ? formatInt(bounds[i]) : `${formatInt(bounds[i])} a ${formatInt(bounds[i + 1])}`));
  }
  if (view.ranking.some((r) => r.value === null)) {
    legend.append(el('li', {}, el('span', { class: 'sw st--nd', 'aria-hidden': 'true' }), 'sin dato'));
  }
}

// ── Archivo Tableau (sólo con ?archivo=tableau) ─────────────────────────────
function setupArchive() {
  if (!state.archivo) return; // experiencia normal: cero recursos de Tableau
  $('tabs').hidden = false;
  const tabs = [$('tab-tablero'), $('tab-archivo')];
  const panels = [$('panel-tablero'), $('panel-archivo')];
  const activate = (i, focus) => {
    tabs.forEach((t, j) => {
      t.setAttribute('aria-selected', String(i === j));
      t.tabIndex = i === j ? 0 : -1;
      panels[j].hidden = i !== j;
    });
    if (focus) tabs[i].focus();
    if (i === 0 && view?.windowRows) renderChart(); // el gráfico vuelve a medir su ancho
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => activate(i, false));
    t.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); activate(1 - i, true); }
    });
  });
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
