// surveillance.mjs: pestaña «Vigilancia» del tablero EpiForecast-MX.
//
// Muestra las categorías no agregadas de la foto vigente del Boletín Epidemiológico
// (assets/boletin/actual.json -> <carpeta>/data.json). Reglas que este módulo hace cumplir:
//   * las celdas se leen con la semántica oficial de ../boletin/celdas.mjs (guion, n.d., n.a.,
//     s.n., celda en blanco); nunca se convierte un marcador o null en cero a mano;
//   * cada categoría conserva su propio corte (observed_week); la semana de portada no lo sustituye;
//     el año de la celda sigue la misma regla que radar.js (corte posterior a la portada => año previo);
//   * las categorías sólo nacionales no reciben estados inventados;
//   * no se generan pronósticos ni puntuaciones: score/score_parts/priority del radar no se exponen;
//     el estado de incorporación del radar no es un veredicto de validación prospectiva;
//   * el DOM se construye con createElement/textContent; ningún dato pasa por innerHTML.
//
// Las funciones puras se exportan para node:test; importar el módulo no toca el DOM.

import { numero, muestra, significado, clase, compararDesc, esMarcador, guionNoPublicado } from '../boletin/celdas.mjs';

export const ACTUAL_URL = 'assets/boletin/actual.json';
export const CATALOG_URL = 'assets/dashboard/catalog.json';
export const PAGE_SIZE = 20;
export const TOP_STATES = 10;

/** Estados del radar que significan «hay un pronóstico publicado en la plataforma». */
export const PUBLISHED_STATUSES = Object.freeze(['Publicada', 'Control publicado']);

export const COVERAGE_FILTERS = Object.freeze([
  { id: '', label: 'Toda la cobertura' },
  { id: 'con', label: 'Con pronóstico publicado' },
  { id: 'sin', label: 'Sin pronóstico publicado' },
].map(Object.freeze));

export const TERRITORY_FILTERS = Object.freeze([
  { id: '', label: 'Con y sin tabla estatal' },
  { id: 'estatal', label: 'Con tabla de 32 entidades' },
  { id: 'nacional', label: 'Sólo resumen nacional' },
].map(Object.freeze));

export const SORTS = Object.freeze([
  { id: 'pagina', label: 'Orden del boletín (página)' },
  { id: 'nombre', label: 'Nombre (A–Z)' },
  { id: 'cumulative', label: 'Acumulado impreso (mayor a menor)' },
  { id: 'weekly', label: 'Semana del cuadro (mayor a menor)' },
].map(Object.freeze));

// Explicación neutral de los estados de incorporación del radar.
const STATUS_NOTES = Object.freeze({
  'Publicada': 'Estado de incorporación en el radar del boletín: la plataforma publica pronósticos de este padecimiento. No es un veredicto de validación prospectiva; consulta la ficha del pronóstico.',
  'Control publicado': 'Estado de incorporación en el radar del boletín: control estacional publicado (rezago de 52 semanas, sin intervalos). No es una validación en curso.',
  'Rechazada': 'Estado de incorporación en el radar del boletín: el portafolio candidato fue rechazado y no hay pronóstico público. No describe la situación epidemiológica.',
  'Por incorporar': 'Estado de incorporación en el radar del boletín: sin modelo público. Las cifras son las impresas en el cuadro.',
});

// ── Utilidades puras ───────────────────────────────────────────────────────
/** Texto para búsqueda: minúsculas y sin acentos. */
export function normalizeText(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Ruta relativa segura a un archivo de la foto vigente; lanza si actual.json no es confiable. */
export function snapshotPaths(actual) {
  if (!actual || typeof actual !== 'object') throw new Error('actual.json inválido');
  const carpeta = String(actual.carpeta ?? '').replace(/^\/+|\/+$/g, '');
  if (!/^assets\/boletin\/[A-Za-z0-9._-]+$/.test(carpeta) || carpeta.includes('..')) {
    throw new Error('actual.json declara una carpeta no válida');
  }
  const pdfName = actual.pdf == null ? null : String(actual.pdf);
  if (pdfName !== null && !/^[A-Za-z0-9._-]+\.pdf$/i.test(pdfName)) throw new Error('actual.json declara un PDF no válido');
  return {
    carpeta,
    data: `${carpeta}/data.json`,
    pdf: pdfName ? `${carpeta}/${pdfName}` : null,
    pdfName,
    volumen: Number.isInteger(actual.volumen) ? actual.volumen : null,
  };
}

/** Enlace al PDF en la página exacta; null si no hay PDF o la página no es válida. */
export function pdfHref(paths, page) {
  if (!paths?.pdf) return null;
  return Number.isInteger(page) && page > 0 ? `${paths.pdf}#page=${page}` : paths.pdf;
}

/** Comprueba la forma mínima del data.json; lanza ante un esquema que no se puede leer con honestidad. */
export function validateSnapshot(data) {
  if (!data || typeof data !== 'object') throw new Error('data.json del boletín inválido');
  const m = data.meta;
  if (!m || !Number.isInteger(m.year) || !Number.isInteger(m.week)) throw new Error('data.json sin meta.year/meta.week');
  if (!Array.isArray(data.diseases) || !data.diseases.length) throw new Error('data.json sin categorías');
  const ids = new Set();
  for (const d of data.diseases) {
    if (!d || typeof d.id !== 'string' || !d.id) throw new Error('Categoría sin id');
    if (ids.has(d.id)) throw new Error(`Categoría duplicada: ${d.id}`);
    ids.add(d.id);
    if (typeof d.name !== 'string' || !d.name) throw new Error(`Categoría sin nombre: ${d.id}`);
    if (!Array.isArray(d.columns) || !Array.isArray(d.states)) throw new Error(`Categoría sin columnas/estados: ${d.id}`);
    for (const s of d.states) {
      if (!s || typeof s.state !== 'string' || !Array.isArray(s.values) || s.values.length !== d.columns.length) {
        throw new Error(`Fila estatal inconsistente en ${d.id}`);
      }
    }
  }
  return data;
}

/** Año al que pertenece el corte de la categoría (misma regla que radar.js). */
export function categoryYear(category, meta) {
  const w = category?.observedWeek ?? category?.observed_week;
  return Number.isInteger(w) && w > meta.week ? meta.year - 1 : meta.year;
}

/**
 * Año al que se refiere una columna del cuadro, para la semántica del guion.
 * Usa el año explícito del rótulo («Acum. 2025», «Sem. 2025»); en un rango («Mediana 2021–2025»)
 * toma el último año, el más reciente que la cifra resume. Sin año explícito: año del corte.
 */
export function columnYear(column, category, meta) {
  const years = String(column ?? '').match(/(?<!\d)(?:19|20)\d{2}(?!\d)/g);
  return years ? Math.max(...years.map(Number)) : categoryYear(category, meta);
}

/** Año de una medida de la fila: `previous` es el acumulado del año anterior al corte. */
export function measureYear(key, category, meta) {
  const y = categoryYear(category, meta);
  return key === 'previous' ? y - 1 : y;
}

/**
 * Valor para calcular según celdas.mjs: número, o null si la celda no tiene valor comparable.
 * `year` opcional fija el año de la celda (columna o medida); por omisión, año del corte.
 */
export function cellValue(v, category, meta, year = null) {
  return numero(v, category?.guion ?? null, Number.isInteger(year) ? year : categoryYear(category, meta));
}

/**
 * Vista de una celda: texto visible, clase CSS, significado del marcador y valor calculable.
 * `year` opcional como en cellValue.
 */
export function cellView(v, category, meta, year = null) {
  const guion = category?.guion ?? null;
  const anio = Number.isInteger(year) ? year : categoryYear(category, meta);
  const cls = clase(v, guion, anio);
  return {
    text: muestra(v),
    cls,
    marker: v == null || esMarcador(v),
    meaning: cls ? significado(v, { guion, simbolos: meta.symbols ?? null, anio }) : '',
    value: numero(v, guion, anio),
  };
}

/**
 * Cobertura de pronóstico: sólo cuando el radar declara la categoría publicada con platform_id y
 * el id existe en el catálogo vigente del tablero. No se inventa ninguna otra cobertura.
 * `publishedIds = null` omite la comprobación de catálogo y sólo existe para pruebas con fixtures;
 * initSurveillance siempre pasa el Set vigente y falla cerrado si el catálogo no carga.
 */
export function coverageOf(row, publishedIds = null) {
  const id = typeof row?.platform_id === 'string' && row.platform_id ? row.platform_id : null;
  const declared = !!id && PUBLISHED_STATUSES.includes(row.status);
  const inCatalog = declared && (publishedIds == null || publishedIds.has(id));
  if (!declared) return { kind: 'sin', forecastId: null, control: false, mismatch: false };
  if (!inCatalog) return { kind: 'sin', forecastId: null, control: row.status === 'Control publicado', mismatch: true };
  return { kind: 'con', forecastId: id, control: row.status === 'Control publicado', mismatch: false };
}

export function statusNote(status) {
  return STATUS_NOTES[status] ?? 'Estado de incorporación declarado por el radar del boletín; no es un veredicto de validación.';
}

/** Ids de padecimientos publicados según el catálogo del tablero (o null si no se pudo leer). */
export function publishedIdsFromCatalog(catalog) {
  const list = catalog?.diseases;
  if (!Array.isArray(list) || !list.length) return null;
  return new Set(list.map(d => d?.id).filter(id => typeof id === 'string' && id));
}

/**
 * Categorías no agregadas, normalizadas, sin score/score_parts/priority.
 * En producción `publishedIds` es el Set del catálogo vigente; null sólo para fixtures (ver coverageOf).
 */
export function buildCategories(data, { publishedIds = null } = {}) {
  validateSnapshot(data);
  const meta = data.meta;
  return data.diseases.filter(d => d.aggregate !== true).map(d => {
    const observedWeek = Number.isInteger(d.observed_week) ? d.observed_week : null;
    const cat = {
      id: d.id,
      name: d.name,
      code: typeof d.code === 'string' ? d.code : '',
      group: typeof d.group === 'string' && d.group ? d.group : 'Sin grupo',
      page: Number.isInteger(d.page) ? d.page : null,
      status: typeof d.status === 'string' ? d.status : '',
      platformId: typeof d.platform_id === 'string' && d.platform_id ? d.platform_id : null,
      observedWeek,
      weekly: d.weekly ?? null,
      cumulative: d.cumulative ?? null,
      previous: d.previous ?? null,
      columns: d.columns.slice(),
      totals: Array.isArray(d.totals) ? d.totals.slice() : [],
      states: d.states.map(s => ({ state: s.state, values: s.values.slice() })),
      hasStates: d.states.length > 0,
      guion: d.guion ?? null,
      cutText: typeof d.cut_text === 'string' ? d.cut_text : '',
      sourceNote: typeof d.source_note === 'string' ? d.source_note : '',
      reconciled: d.reconciled ?? null,
      coverage: coverageOf(d, publishedIds),
    };
    cat.year = categoryYear(cat, meta);
    cat.searchText = normalizeText(`${cat.name} ${cat.code} ${cat.group} ${cat.platformId ?? ''}`);
    return cat;
  });
}

/** Grupos presentes, con conteo, en orden alfabético español. */
export function groupsOf(categories) {
  const counts = new Map();
  for (const c of categories) counts.set(c.group, (counts.get(c.group) ?? 0) + 1);
  return [...counts].map(([group, count]) => ({ group, count })).sort((a, b) => a.group.localeCompare(b.group, 'es'));
}

export function summarizeSurveillance(categories) {
  const con = categories.filter(c => c.coverage.kind === 'con');
  return {
    total: categories.length,
    stateBlocks: categories.filter(c => c.hasStates).length,
    nationalOnly: categories.filter(c => !c.hasStates).length,
    withForecast: con.length,
    withoutForecast: categories.length - con.length,
    forecastIds: new Set(con.map(c => c.coverage.forecastId)).size,
    groups: groupsOf(categories).length,
  };
}

/** Filtra y ordena; los marcadores sin valor numérico van al final, nunca como cero. */
export function filterCategories(categories, { query = '', group = '', coverage = '', territory = '', sort = 'pagina' } = {}, meta = null) {
  const terms = normalizeText(query).split(' ').filter(Boolean);
  const out = categories.filter(c =>
    terms.every(t => c.searchText.includes(t)) &&
    (!group || c.group === group) &&
    (!coverage || c.coverage.kind === coverage) &&
    (!territory || (territory === 'estatal' ? c.hasStates : !c.hasStates)));
  const byName = (a, b) => a.name.localeCompare(b.name, 'es');
  const byPage = (a, b) => (a.page ?? Infinity) - (b.page ?? Infinity) || byName(a, b);
  if (sort === 'nombre') out.sort(byName);
  else if ((sort === 'cumulative' || sort === 'weekly') && meta) {
    out.sort((a, b) => compararDesc(cellValue(a[sort], a, meta), cellValue(b[sort], b, meta)) || byName(a, b));
  } else out.sort(byPage);
  return out;
}

export function paginate(list, page, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const p = Math.min(Math.max(0, Number.isInteger(page) ? page : 0), pages - 1);
  const start = p * size;
  return { items: list.slice(start, start + size), page: p, pages, total: list.length, start, end: Math.min(list.length, start + size) };
}

/**
 * Selección tras filtrar: conserva `selectedId` sólo si sigue en `results`; si no, la primera
 * categoría de los resultados; null cuando no hay resultados (nunca una categoría filtrada fuera).
 */
export function resolveSelection(results, selectedId) {
  if (selectedId != null && results.some(c => c.id === selectedId)) return selectedId;
  return results[0]?.id ?? null;
}

/** Las tres medidas del cuadro con su rótulo de corte y fuente; cada una evalúa el guion en su año. */
export function measures(cat, meta) {
  const y = categoryYear(cat, meta);
  const corte = cat.observedWeek != null ? `semana ${cat.observedWeek} de ${y}` : 'corte no recuperado del encabezado';
  const m = (key, label) => {
    const year = measureYear(key, cat, meta);
    return { key, label, year, corte, ...cellView(cat[key], cat, meta, year) };
  };
  return [
    m('weekly', cat.observedWeek != null ? `Semana ${cat.observedWeek} de ${y}` : 'Semana del cuadro'),
    m('cumulative', `Acumulado ${y} al corte`),
    m('previous', `Acumulado ${y - 1} al mismo corte`),
  ];
}

/** Años de las columnas del cuadro (ver columnYear). */
export function columnYears(cat, meta) {
  return cat.columns.map(c => columnYear(c, cat, meta));
}

/** Filas estatales con la vista de cada celda en el año de su columna; vacío si es sólo nacional. */
export function stateRows(cat, meta) {
  const years = columnYears(cat, meta);
  return cat.states.map(s => ({ state: s.state, cells: s.values.map((v, i) => cellView(v, cat, meta, years[i])) }));
}

/**
 * Pie de la tabla sobre el guion. Afirma «cifra no publicada» sólo si guionNoPublicado(guion, año
 * del corte) lo establece; si otras columnas del cuadro caen fuera de ese régimen, lo aclara.
 */
export function dashCaption(cat, meta) {
  const simbolo = meta.symbols?.simbolos?.['-'] ?? 'no se presentaron casos';
  const y = categoryYear(cat, meta);
  const guion = cat.guion ?? null;
  if (!guionNoPublicado(guion, y)) return `«–» es el guion impreso por el boletín; su simbología lo define como «${simbolo}».`;
  const oficiales = [...new Set(cat.columns.filter(c => !guionNoPublicado(guion, columnYear(c, cat, meta))))];
  return `«–» es el guion impreso por el boletín: en este cuadro, para ${y}, es una cifra no publicada, no un cero.` +
    (oficiales.length ? ` En ${oficiales.map(c => `«${c}»`).join(', ')} (años anteriores a ${guion.desde}) conserva la simbología oficial: «${simbolo}».` : '');
}

/** Totales impresos con la vista de cada celda en el año de su columna. */
export function totalCells(cat, meta) {
  const years = columnYears(cat, meta);
  return cat.totals.map((v, i) => cellView(v, cat, meta, years[i]));
}

/**
 * Entidades con más notificaciones en una columna del cuadro (conteos impresos, no riesgo ni tasa).
 * Las celdas sin valor comparable no se ordenan como cero: se cuentan aparte.
 */
export function topStates(cat, meta, column = 0, k = TOP_STATES) {
  if (!cat.hasStates || column < 0 || column >= cat.columns.length) return { column: null, rows: [], withoutValue: 0, max: null };
  const year = columnYear(cat.columns[column], cat, meta);
  const all = cat.states.map(s => ({ state: s.state, raw: s.values[column], value: cellValue(s.values[column], cat, meta, year) }));
  const valued = all.filter(r => r.value !== null).sort((a, b) => compararDesc(a.value, b.value) || a.state.localeCompare(b.state, 'es'));
  const rows = valued.slice(0, k);
  const max = rows.length ? Math.max(...rows.map(r => r.value)) : null;
  return { column: cat.columns[column], rows, withoutValue: all.length - valued.length, max };
}

// ── DOM ─────────────────────────────────────────────────────────────────────
const SVG_NS = 'http://www.w3.org/2000/svg';
let uid = 0;

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}

function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v));
  for (const c of children.flat()) if (c != null) el.append(c);
  return el;
}

function cellNode(view, tag = 'span') {
  const el = h(tag, { class: view.cls ? `sv-cell ${view.cls}` : 'sv-cell' }, view.text);
  if (view.meaning) el.title = view.meaning;
  return el;
}

function option(value, label, selected) {
  const o = h('option', { value }, label);
  if (selected) o.selected = true;
  return o;
}

function badge(cat) {
  const kind = cat.coverage.kind === 'con' ? (cat.coverage.control ? 'control' : 'con') : 'sin';
  const label = cat.coverage.kind === 'con'
    ? (cat.coverage.control ? 'Control publicado' : 'Pronóstico publicado')
    : 'Sin pronóstico publicado';
  return h('span', { class: `sv-badge sv-badge-${kind}` }, label);
}

function barsSvg(top, titleId, descId) {
  const rowH = 26, labelW = 150, valueW = 64, width = 520, barW = width - labelW - valueW;
  const height = Math.max(1, top.rows.length) * rowH + 8;
  const svg = s('svg', { class: 'sv-bars', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-labelledby': `${titleId} ${descId}`, preserveAspectRatio: 'xMinYMin meet' });
  top.rows.forEach((r, i) => {
    const y = 4 + i * rowH;
    const w = top.max > 0 ? Math.max(r.value > 0 ? 2 : 0, (r.value / top.max) * barW) : 0;
    const label = s('text', { x: labelW - 8, y: y + rowH / 2 + 4, 'text-anchor': 'end', class: 'sv-bars-label' });
    label.textContent = r.state.length > 22 ? `${r.state.slice(0, 21)}…` : r.state;
    const value = s('text', { x: labelW + w + 6, y: y + rowH / 2 + 4, class: 'sv-bars-value' });
    value.textContent = Number(r.value).toLocaleString('es-MX');
    svg.append(s('rect', { x: labelW, y: y + 5, width: w.toFixed(1), height: rowH - 10, rx: 2, class: 'sv-bars-fill' }), label, value);
  });
  return svg;
}

/**
 * Inicializa la pestaña Vigilancia dentro de `root`.
 * @param {{root: HTMLElement, load: (url: string) => Promise<any>, onSelectForecast?: (id: string) => void}} opts
 * @returns {Promise<{select: (id: string) => boolean, destroy: () => void}>}
 */
export async function initSurveillance({ root, load, onSelectForecast } = {}) {
  if (!root || typeof root.append !== 'function') throw new Error('initSurveillance: falta el contenedor root');
  if (typeof load !== 'function') throw new Error('initSurveillance: falta load(url)');
  const prefix = `sv${++uid}`;
  const state = { query: '', group: '', coverage: '', territory: '', sort: 'pagina', page: 0, selected: null, column: 0 };
  let ctx = null;
  let alive = true;
  let attempt = 0;

  root.classList.add('sv-root');

  function showLoading() {
    root.replaceChildren(h('p', { class: 'sv-status', role: 'status' }, 'Cargando la foto vigente del boletín…'));
    root.setAttribute('aria-busy', 'true');
  }

  function showError(err) {
    // Un error oculta cualquier dato anterior: no se deja una tabla vieja como si fuera vigente.
    const retry = h('button', { type: 'button', class: 'sv-button', onclick: () => { start().catch(() => {}); } }, 'Reintentar');
    root.replaceChildren(h('div', { class: 'sv-error', role: 'alert' },
      h('p', {}, 'No se pudo cargar la vigilancia del boletín. No se muestran cifras parciales.'),
      h('p', { class: 'sv-muted' }, String(err?.message ?? err)),
      retry));
    root.setAttribute('aria-busy', 'false');
  }

  async function fetchAll() {
    const actual = await load(ACTUAL_URL);
    const paths = snapshotPaths(actual);
    // El catálogo vigente es obligatorio: sin él no se habilita ningún pronóstico (falla cerrado).
    const [data, catalog] = await Promise.all([load(paths.data), load(CATALOG_URL)]);
    validateSnapshot(data);
    const publishedIds = publishedIdsFromCatalog(catalog);
    if (!publishedIds || !publishedIds.size) throw new Error('Catálogo del tablero inválido o vacío: no se puede verificar la cobertura de pronósticos');
    const categories = buildCategories(data, { publishedIds });
    return { actual, paths, data, meta: data.meta, categories };
  }

  async function start() {
    const token = ++attempt;
    showLoading();
    try {
      const loaded = await fetchAll();
      if (!alive || token !== attempt) return;
      ctx = loaded;
      buildShell();
    } catch (err) {
      if (!alive || token !== attempt) return;
      ctx = null;
      showError(err);
      throw err;
    }
  }

  // Elementos persistentes del armazón.
  let els = {};

  function buildShell() {
    const { meta, paths, categories } = ctx;
    const sum = summarizeSurveillance(categories);
    const groups = groupsOf(categories);

    const search = h('input', { id: `${prefix}-q`, type: 'search', class: 'sv-input', autocomplete: 'off', placeholder: 'Nombre, CIE o grupo', value: state.query });
    const group = h('select', { id: `${prefix}-g`, class: 'sv-input' },
      option('', `Todos los grupos (${groups.length})`, !state.group),
      groups.map(g => option(g.group, `${g.group} (${g.count})`, state.group === g.group)));
    const coverage = h('select', { id: `${prefix}-c`, class: 'sv-input' }, COVERAGE_FILTERS.map(f => option(f.id, f.label, state.coverage === f.id)));
    const territory = h('select', { id: `${prefix}-t`, class: 'sv-input' }, TERRITORY_FILTERS.map(f => option(f.id, f.label, state.territory === f.id)));
    const sort = h('select', { id: `${prefix}-s`, class: 'sv-input' }, SORTS.map(f => option(f.id, f.label, state.sort === f.id)));
    const reset = h('button', { type: 'button', class: 'sv-button sv-button-quiet' }, 'Limpiar filtros');

    const field = (input, text) => h('div', { class: 'sv-field' }, h('label', { for: input.id }, text), input);
    const onFilter = () => {
      state.query = search.value; state.group = group.value; state.coverage = coverage.value;
      state.territory = territory.value; state.sort = sort.value; state.page = 0;
      applyFilters();
    };
    search.addEventListener('input', onFilter);
    for (const el of [group, coverage, territory, sort]) el.addEventListener('change', onFilter);
    reset.addEventListener('click', () => {
      search.value = ''; group.value = ''; coverage.value = ''; territory.value = ''; sort.value = 'pagina';
      onFilter();
      search.focus();
    });

    const count = h('p', { class: 'sv-count', role: 'status', 'aria-live': 'polite' });
    const list = h('ul', { class: 'sv-list', 'aria-label': 'Categorías de vigilancia' });
    const prev = h('button', { type: 'button', class: 'sv-button sv-button-quiet' }, 'Anterior');
    const next = h('button', { type: 'button', class: 'sv-button sv-button-quiet' }, 'Siguiente');
    const pageInfo = h('span', { class: 'sv-pageinfo' });
    prev.addEventListener('click', () => { if (state.page > 0) { state.page--; renderList(); list.querySelector('button')?.focus(); } });
    next.addEventListener('click', () => { state.page++; renderList(); list.querySelector('button')?.focus(); });
    const detail = h('section', { class: 'sv-detail', 'aria-label': 'Detalle de la categoría' });

    const pdfAll = pdfHref(paths, null);
    const periodo = [meta.period, meta.publication ? `publicado el ${meta.publication}` : null].filter(Boolean).join('; ');
    const header = h('header', { class: 'sv-head' },
      h('p', { class: 'sv-kicker' }, 'Vigilancia epidemiológica · cifras impresas'),
      h('h2', { class: 'sv-title' }, `Boletín Epidemiológico, semana ${meta.week} de ${meta.year}${paths.volumen ? ` (vol. ${paths.volumen})` : ''}`),
      h('p', { class: 'sv-lede' },
        `${periodo ? `${periodo}. ` : ''}Cada categoría conserva el corte de su propio cuadro; la semana de portada no lo sustituye. `,
        'Las cifras son notificaciones del SINAVE tal como se imprimen: un guion o un marcador no se convierte en cero salvo cuando la simbología oficial lo define así. ',
        'Esta pestaña no genera pronósticos, puntuaciones ni alertas.'),
      h('ul', { class: 'sv-summary', 'aria-label': 'Resumen de la foto vigente' },
        h('li', {}, h('strong', {}, String(sum.total)), ' categorías no agregadas'),
        h('li', {}, h('strong', {}, String(sum.stateBlocks)), ' con tabla de 32 entidades'),
        h('li', {}, h('strong', {}, String(sum.nationalOnly)), ' sólo con resumen nacional'),
        h('li', {}, h('strong', {}, String(sum.withForecast)), ` con pronóstico publicado (${sum.forecastIds} padecimientos)`)),
      h('p', { class: 'sv-muted' },
        'Se excluye el agregado de infecciones intestinales para no contar dos veces. ',
        pdfAll ? h('a', { href: pdfAll, target: '_blank', rel: 'noopener' }, 'Abrir el PDF completo del boletín') : null));

    const filters = h('form', { class: 'sv-filters', role: 'search', 'aria-label': 'Filtrar categorías', onsubmit: e => e.preventDefault() },
      field(search, 'Buscar categoría'), field(group, 'Grupo'), field(coverage, 'Cobertura'), field(territory, 'Desglose territorial'),
      field(sort, 'Ordenar por'), h('div', { class: 'sv-field sv-field-end' }, reset));

    const layout = h('div', { class: 'sv-layout' },
      h('div', { class: 'sv-browser' }, count, list, h('nav', { class: 'sv-pager', 'aria-label': 'Paginación de categorías' }, prev, pageInfo, next)),
      detail);

    els = { search, list, count, prev, next, pageInfo, detail };
    root.replaceChildren(header, filters, layout);
    root.setAttribute('aria-busy', 'false');
    state.selected = resolveSelection(currentList(), state.selected);
    renderList();
    renderDetail(false);
  }

  function currentList() {
    return filterCategories(ctx.categories, state, ctx.meta);
  }

  // Tras cambiar un filtro: la selección sólo se conserva si sigue en los resultados; si no, pasa a
  // la primera que queda (o a ninguna). El detalle se redibuja sin mover el foco del control activo.
  function applyFilters() {
    const prev = state.selected;
    state.selected = resolveSelection(currentList(), prev);
    renderList();
    if (state.selected !== prev || state.selected === null) renderDetail(false);
  }

  function renderList() {
    const all = currentList();
    const pg = paginate(all, state.page);
    state.page = pg.page;
    const { list, count, prev, next, pageInfo } = els;
    count.textContent = pg.total
      ? `${pg.total} de ${ctx.categories.length} categorías · mostrando ${pg.start + 1}–${pg.end}`
      : `Ninguna de las ${ctx.categories.length} categorías coincide con los filtros.`;
    list.replaceChildren(...pg.items.map(cat => {
      const corte = cat.observedWeek != null ? `corte S${cat.observedWeek}/${cat.year}` : 'corte no recuperado';
      const btn = h('button', { type: 'button', class: 'sv-item', 'aria-pressed': String(cat.id === state.selected), 'data-id': cat.id },
        h('span', { class: 'sv-item-name' }, cat.name),
        h('span', { class: 'sv-item-meta' }, [cat.code, cat.group, corte, cat.page ? `p. ${cat.page}` : null, cat.hasStates ? '32 entidades' : 'sólo nacional'].filter(Boolean).join(' · ')),
        badge(cat));
      btn.addEventListener('click', () => { state.selected = cat.id; markSelected(); renderDetail(true); });
      return h('li', {}, btn);
    }));
    prev.disabled = pg.page === 0;
    next.disabled = pg.page >= pg.pages - 1;
    pageInfo.textContent = `Página ${pg.page + 1} de ${pg.pages}`;
  }

  function markSelected() {
    for (const b of els.list.querySelectorAll('.sv-item')) b.setAttribute('aria-pressed', String(b.dataset.id === state.selected));
  }

  function renderDetail(focus) {
    const { detail } = els;
    const cat = ctx.categories.find(c => c.id === state.selected);
    if (!cat) {
      // Sin selección no queda ninguna cifra de una categoría filtrada fuera.
      detail.removeAttribute('aria-labelledby');
      detail.replaceChildren(h('p', { class: 'sv-muted' }, currentList().length
        ? 'Elige una categoría para ver sus cifras, su corte y su página del boletín.'
        : 'Ninguna categoría coincide con los filtros; no hay detalle que mostrar.'));
      return;
    }
    const { meta, paths } = ctx;
    const titleId = `${prefix}-dt`;
    const title = h('h3', { id: titleId, class: 'sv-detail-title', tabindex: '-1' }, cat.name);
    detail.setAttribute('aria-labelledby', titleId);
    const href = pdfHref(paths, cat.page);

    const ms = measures(cat, meta);
    const stats = h('dl', { class: 'sv-stats' }, ms.map(m => h('div', { class: 'sv-stat' },
      h('dt', {}, m.label),
      h('dd', {}, cellNode(m, 'strong'), m.meaning ? h('small', { class: 'sv-meaning' }, m.meaning) : null))));

    const source = h('p', { class: 'sv-source' },
      h('b', {}, 'Fuente: '),
      cat.cutText ? `${cat.cutText}. ` : '',
      cat.observedWeek != null
        ? `Corte de esta categoría: semana ${cat.observedWeek} de ${cat.year} (portada: semana ${meta.week} de ${meta.year}). `
        : `El encabezado del cuadro no permitió recuperar su corte; portada: semana ${meta.week} de ${meta.year}. `,
      href ? h('a', { href, target: '_blank', rel: 'noopener' }, cat.page ? `PDF del boletín, página ${cat.page}` : 'PDF del boletín') : 'PDF no disponible.');

    const notes = [];
    if (cat.sourceNote) notes.push(h('p', { class: 'sv-note' }, cat.sourceNote));
    if (cat.guion) {
      const ev = Array.isArray(cat.guion.evidencia) ? cat.guion.evidencia : [];
      notes.push(h('p', { class: 'sv-note' }, cat.guion.nota ?? 'En este cuadro el guion es una cifra no publicada, no un cero.',
        ev.length ? ` Fuentes: ${ev.map(e => `${e.archivo}, p. ${e.pagina}${e.cita ? ` («${e.cita}»)` : ''}`).join('; ')}.` : ''));
    }

    // Cobertura y estado del radar.
    let forecast;
    if (cat.coverage.kind === 'con') {
      const btn = h('button', { type: 'button', class: 'sv-button' }, 'Abrir pronóstico publicado');
      btn.addEventListener('click', () => { if (typeof onSelectForecast === 'function') onSelectForecast(cat.coverage.forecastId); });
      forecast = h('div', { class: 'sv-forecast' },
        h('p', {}, cat.coverage.control
          ? 'Esta categoría está cubierta por un control estacional publicado (rezago de 52 semanas, sin intervalos), no por una validación en curso.'
          : 'Esta categoría tiene un pronóstico publicado en el tablero. El estado del radar no es un veredicto prospectivo: consulta la ficha del explorador.'),
        typeof onSelectForecast === 'function' ? btn : null);
    } else {
      forecast = h('div', { class: 'sv-forecast sv-forecast-none' },
        h('p', {}, cat.coverage.mismatch
          ? 'El radar declara un pronóstico publicado, pero su identificador no está en el catálogo vigente del tablero; no se enlaza.'
          : 'Sin pronóstico publicado para esta categoría. Este tablero no genera uno.'));
    }

    const children = [
      title,
      h('p', { class: 'sv-detail-meta' }, [cat.code, cat.group, cat.page ? `p. ${cat.page}` : null].filter(Boolean).join(' · ')),
      h('p', { class: 'sv-detail-status' }, badge(cat), ' ', h('span', { class: 'sv-muted' }, `Radar: ${cat.status || 'sin estado'}. ${statusNote(cat.status)}`)),
      stats, source, ...notes, forecast,
    ];

    if (cat.hasStates) {
      if (state.column >= cat.columns.length) state.column = 0;
      const colSelect = h('select', { id: `${prefix}-col`, class: 'sv-input' }, cat.columns.map((c, i) => option(String(i), c, i === state.column)));
      const chartWrap = h('div', { class: 'sv-chart' });
      const drawChart = () => {
        const top = topStates(cat, meta, state.column);
        const tId = `${prefix}-ct`, dId = `${prefix}-cd`;
        chartWrap.replaceChildren(
          h('p', { id: tId, class: 'sv-chart-title' }, `Entidades con más notificaciones · columna «${top.column}»`),
          top.rows.length ? barsSvg(top, tId, dId) : h('p', { class: 'sv-muted' }, 'Ninguna entidad tiene una cifra comparable en esta columna.'),
          h('p', { id: dId, class: 'sv-caption' },
            `Conteos impresos en el cuadro, ${top.rows.length} de ${cat.states.length} entidades; no son tasas ni indicadores de riesgo.`,
            top.withoutValue ? ` ${top.withoutValue} ${top.withoutValue === 1 ? 'entidad no tiene' : 'entidades no tienen'} cifra comparable y no se ordenan como cero.` : ''));
      };
      colSelect.addEventListener('change', () => { state.column = Number(colSelect.value) || 0; drawChart(); });
      drawChart();

      const rows = stateRows(cat, meta);
      const totals = totalCells(cat, meta);
      const table = h('table', { class: 'sv-table' },
        h('caption', {}, `${cat.states.length} entidades · cifras originales del cuadro (corte semana ${cat.observedWeek ?? 'n.d.'} de ${cat.year})`),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Entidad'), cat.columns.map(c => h('th', { scope: 'col', class: 'sv-num' }, c)))),
        h('tbody', {},
          rows.map(r => h('tr', {}, h('th', { scope: 'row' }, r.state), r.cells.map(c => h('td', { class: 'sv-num' }, cellNode(c))))),
          totals.length ? h('tr', { class: 'sv-total' }, h('th', { scope: 'row' }, 'Total impreso'), totals.map(c => h('td', { class: 'sv-num' }, cellNode(c)))) : null));
      children.push(
        h('h4', { class: 'sv-subhead' }, 'Desglose por entidad'),
        h('div', { class: 'sv-field sv-field-inline' }, h('label', { for: colSelect.id }, 'Columna del gráfico'), colSelect),
        chartWrap,
        h('div', { class: 'sv-table-wrap', tabindex: '0', role: 'region', 'aria-label': `Tabla por entidad de ${cat.name}` }, table),
        h('p', { class: 'sv-caption' },
          dashCaption(cat, meta),
          cat.reconciled === true ? ' Las columnas reconcilian con el total nacional impreso.' : ''));
    } else {
      const totals = totalCells(cat, meta);
      children.push(
        h('h4', { class: 'sv-subhead' }, 'Resumen nacional'),
        h('p', { class: 'sv-muted' }, 'El boletín publica esta categoría sólo en el resumen nacional; no hay tabla por entidad y no se imputan cifras estatales.'),
        totals.length ? h('div', { class: 'sv-table-wrap', tabindex: '0', role: 'region', 'aria-label': `Resumen nacional de ${cat.name}` },
          h('table', { class: 'sv-table' },
            h('thead', {}, h('tr', {}, cat.columns.map(c => h('th', { scope: 'col', class: 'sv-num' }, c)))),
            h('tbody', {}, h('tr', {}, totals.map(c => h('td', { class: 'sv-num' }, cellNode(c))))))) : null);
    }

    detail.replaceChildren(...children.filter(Boolean));
    if (focus) title.focus();
  }

  // Un fallo de carga se muestra dentro de root con su propio botón «Reintentar»; la promesa
  // se resuelve igualmente para que la UI no vuelva a inicializar el módulo.
  await start().catch(() => {});
  return controller();

  function controller() {
    return {
      get ready() { return ctx !== null; },
      select(id) {
        // Sólo categorías presentes en los resultados filtrados actuales.
        if (!ctx || !els.list || !currentList().some(c => c.id === id)) return false;
        state.selected = id;
        markSelected();
        renderDetail(true);
        return true;
      },
      retry: () => start().catch(() => {}),
      destroy() {
        alive = false;
        root.replaceChildren();
        root.classList.remove('sv-root');
        root.removeAttribute('aria-busy');
      },
    };
  }
}
