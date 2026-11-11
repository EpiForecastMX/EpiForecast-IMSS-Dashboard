// data.mjs: lógica pura del tablero EpiForecast-MX.
// Sin acceso al DOM ni a la red: todo lo que vive aquí se prueba con node:test.
// Reglas de honestidad que este módulo hace cumplir:
//   * cada serie (padecimiento, territorio, sexo) se lee tal cual; nunca se suman
//     sexos ni se combina el nacional con los estados (el nacional es un modelo propio);
//   * "y" sólo cuenta como pronóstico después de ds_corte (emisión de 52 pasos);
//     lo anterior al corte no se presenta como pronóstico;
//   * después de last_real el pronóstico es futuro aún no observado;
//   * los incrementos netos negativos (revisiones del acumulado) se conservan, sin recorte;
//   * null es "sin dato" y 0 es un valor real.

export const COHORTS = Object.freeze({
  neuro: 'Reports/zoom_data_neuro.json',
  dengue: 'Reports/zoom_data_dengue.json',
});
export const KNOWLEDGE_URL = 'epibot/knowledge.json';
export const MAP_URL = 'mexico_paths.json';
export const TABLEAU_ARCHIVE_URL = 'EpiDashboard-tableau.html';

export const PADECIMIENTOS = Object.freeze([
  { id: 'depresion', label: 'Depresión', cohort: 'neuro', folder: 'Depresión', metodologia: 'bitacora_modelado.html' },
  { id: 'parkinson', label: 'Parkinson', cohort: 'neuro', folder: 'Parkinson', metodologia: 'bitacora_modelado.html' },
  { id: 'alzheimer', label: 'Alzheimer', cohort: 'neuro', folder: 'Alzheimer', metodologia: 'bitacora_modelado.html' },
  { id: 'dengue', label: 'Dengue', cohort: 'dengue', folder: 'dengue', metodologia: 'metodologia_dengue.html' },
].map(Object.freeze));

export const SEXOS = Object.freeze([
  { id: 'general', label: 'General' },
  { id: 'hombres', label: 'Hombres' },
  { id: 'mujeres', label: 'Mujeres' },
].map(Object.freeze));

export const VENTANAS = Object.freeze([
  { id: 'todo', label: 'Serie completa disponible' },
  { id: 'reciente', label: 'Últimas 26 semanas observadas y pronóstico' },
  { id: 'observado', label: 'Sólo semanas observadas' },
  { id: 'pronostico', label: 'Sólo pronóstico emitido' },
].map(Object.freeze));

export const METRICAS = Object.freeze([
  { id: 'pronostico', label: 'Pronóstico emitido (posterior al corte)' },
  { id: 'observado', label: 'Observado en la ventana' },
].map(Object.freeze));

export const FASES = Object.freeze({
  observado: { label: 'Observado, previo al corte', csv: 'observado_previo_corte' },
  verificable: { label: 'Pronóstico ya observado', csv: 'pronostico_con_observacion' },
  futuro: { label: 'Pronóstico aún no observado', csv: 'pronostico_futuro' },
});

// Las 32 entidades con su nombre visible correcto. El id se deriva de normName().
const ESTADO_LABELS = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas',
  'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Guanajuato',
  'Guerrero', 'Hidalgo', 'Jalisco', 'Estado de México', 'Michoacán', 'Morelos', 'Nayarit',
  'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí',
  'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
];

const REGION_LABELS = Object.freeze({
  'region-metropolitana-alta': 'Región Metropolitana alta',
  'region-rural-dispersa': 'Región Rural dispersa',
  'region-sur-sureste-vulnerable': 'Región Sur-Sureste vulnerable',
  'region-urbana-media': 'Región Urbana media',
});

// ── Normalización de nombres ────────────────────────────────────────────────
/** Minúsculas, sin acentos, guion bajo como espacio. "Estado de México" ≡ "México". */
export function normName(value) {
  const n = String(value ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  return n === 'estado de mexico' ? 'mexico' : n;
}

export function slugify(value) {
  return normName(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export const ESTADOS = Object.freeze(ESTADO_LABELS.map((label) =>
  Object.freeze({ slug: slugify(label), label })));

const ESTADO_BY_SLUG = new Map(ESTADOS.map((e) => [e.slug, e]));

/** Clasifica la carpeta de entidad de una llave zoom. */
export function entityInfo(folder) {
  const slug = slugify(folder);
  if (!slug) return null;
  if (slug === 'nacional') return { slug, tipo: 'nacional', label: 'Nacional' };
  const estado = ESTADO_BY_SLUG.get(slug);
  if (estado) return { slug, tipo: 'estado', label: estado.label };
  if (slug.startsWith('region-')) {
    const pretty = String(folder).replace(/_-_/g, ' ').replace(/_/g, ' ').replace(/^Region\b/, 'Región');
    return { slug, tipo: 'region', label: REGION_LABELS[slug] ?? pretty };
  }
  return { slug, tipo: 'otro', label: String(folder).replace(/_/g, ' ') };
}

// ── Llaves e índice ─────────────────────────────────────────────────────────
const KEY_RE = /^([^/]+)\/([^/]+)\/([^/]+)_(general|hombres|mujeres)\.png$/;

/** "Depresión/Jalisco/Depresión_Jalisco_hombres.png" → {folder, entity, sexo}. */
export function parseKey(key) {
  if (typeof key !== 'string') return null;
  const m = KEY_RE.exec(key);
  if (!m) return null;
  return { folder: m[1], entity: m[2], sexo: m[4] };
}

export function padecimientoById(id) {
  return PADECIMIENTOS.find((p) => p.id === id) ?? null;
}

/**
 * Índice de un padecimiento dentro de un archivo zoom.
 * entities: Map slug → {slug, tipo, label, keys:{general?,hombres?,mujeres?}}, en orden
 * nacional, estados (orden oficial), regiones.
 */
export function buildIndex(raw, padecimientoId) {
  const pad = padecimientoById(padecimientoId);
  const found = new Map();
  if (!pad || !raw || typeof raw !== 'object') return { padecimiento: pad, entities: found };
  const target = normName(pad.folder);
  for (const key of Object.keys(raw)) {
    const parsed = parseKey(key);
    if (!parsed || normName(parsed.folder) !== target) continue;
    const info = entityInfo(parsed.entity);
    if (!info || info.tipo === 'otro') continue;
    if (!found.has(info.slug)) found.set(info.slug, { ...info, keys: {} });
    found.get(info.slug).keys[parsed.sexo] = key;
  }
  const order = { nacional: 0, estado: 1, region: 2 };
  const estadoPos = new Map(ESTADOS.map((e, i) => [e.slug, i]));
  const sorted = [...found.values()].sort((a, b) =>
    (order[a.tipo] - order[b.tipo]) ||
    ((estadoPos.get(a.slug) ?? 0) - (estadoPos.get(b.slug) ?? 0)) ||
    a.label.localeCompare(b.label, 'es'));
  return { padecimiento: pad, entities: new Map(sorted.map((e) => [e.slug, e])) };
}

/** Territorio válido para el índice; si no existe, cae a nacional y lo avisa. */
export function resolveTerritory(index, slug) {
  if (index.entities.has(slug)) return { t: slug, fallback: false };
  if (index.entities.has('nacional')) return { t: 'nacional', fallback: slug !== 'nacional' };
  const first = index.entities.keys().next();
  return { t: first.done ? null : first.value, fallback: true };
}

// ── Series ──────────────────────────────────────────────────────────────────
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const toNum = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const toIso = (v) => (typeof v === 'string' && ISO_RE.test(v) ? v : null);
const toWeek = (v) => (v && Number.isInteger(v.anio) && Number.isInteger(v.semana)
  ? { anio: v.anio, semana: v.semana } : null);

/** Valida y normaliza un objeto zoom. Devuelve null si no hay fechas utilizables. */
export function normalizeSeries(entry) {
  if (!entry || typeof entry !== 'object' || !Array.isArray(entry.d)) return null;
  const d = [], r = [], y = [];
  entry.d.forEach((date, i) => {
    const iso = toIso(date);
    if (!iso) return;
    d.push(iso);
    r.push(toNum(Array.isArray(entry.r) ? entry.r[i] : null));
    y.push(toNum(Array.isArray(entry.y) ? entry.y[i] : null));
  });
  if (!d.length) return null;
  return {
    motor: typeof entry.motor === 'string' && entry.motor.trim() ? entry.motor.trim() : 'Sin dato',
    d, r, y,
    lastReal: toIso(entry.last_real),
    dsCorte: toIso(entry.ds_corte),
    corteModelo: toWeek(entry.corte_modelo),
    ultimaSemanaBoletin: toWeek(entry.ultima_semana_boletin),
    intervaloDisponible: entry.intervalo_disponible === true,
  };
}

export function getSeries(raw, index, slug, sexo) {
  const key = index.entities.get(slug)?.keys?.[sexo];
  return key ? normalizeSeries(raw[key]) : null;
}

/** Fase de una semana respecto al corte y a la última observación. */
export function faseDe(date, dsCorte, lastReal) {
  if (!dsCorte || date <= dsCorte) return 'observado';
  if (lastReal && date <= lastReal) return 'verificable';
  return 'futuro';
}

/** Filas semanales. pron es null antes del corte: ahí "y" no es pronóstico emitido. */
export function buildRows(series) {
  return series.d.map((date, i) => {
    const fase = faseDe(date, series.dsCorte, series.lastReal);
    return {
      i,
      date,
      fase,
      real: series.r[i],
      pron: series.dsCorte && fase !== 'observado' ? series.y[i] : null,
    };
  });
}

export function windowById(id) {
  return VENTANAS.find((v) => v.id === id) ?? VENTANAS[0];
}

/** Recorta filas a la ventana temporal elegida. */
export function applyWindow(rows, ventana, series) {
  switch (ventana) {
    case 'observado':
      return series.lastReal ? rows.filter((r) => r.date <= series.lastReal) : rows.filter((r) => r.real !== null);
    case 'pronostico':
      return rows.filter((r) => r.fase !== 'observado');
    case 'reciente': {
      let anchor = series.lastReal ? rows.findLastIndex((r) => r.date <= series.lastReal) : -1;
      if (anchor < 0) anchor = rows.findLastIndex((r) => r.real !== null);
      if (anchor < 0) return rows;
      return rows.slice(Math.max(0, anchor - 25));
    }
    default:
      return rows;
  }
}

/** Suma honesta: cuenta valores, nulls y negativos; no recorta. */
export function summarize(rows, field) {
  let sum = 0, n = 0, nNull = 0, negatives = 0;
  for (const row of rows) {
    const v = row[field];
    if (v === null || v === undefined) { nNull += 1; continue; }
    sum += v; n += 1;
    if (v < 0) negatives += 1;
  }
  return {
    sum: n ? sum : null,
    n, nNull, negatives,
    weeks: rows.length,
    first: rows.length ? rows[0].date : null,
    last: rows.length ? rows[rows.length - 1].date : null,
  };
}

/** KPIs de la selección. allRows = serie completa; windowRows = ventana activa. */
export function computeKpis(series, allRows, windowRows) {
  const emitted = allRows.filter((r) => r.fase !== 'observado');
  const futuros = allRows.filter((r) => r.fase === 'futuro');
  const verif = allRows.filter((r) => r.fase === 'verificable');
  const pares = verif.filter((r) => r.real !== null && r.pron !== null);
  const observedRows = windowRows.filter((r) =>
    series.lastReal ? r.date <= series.lastReal : r.fase === 'observado');
  return {
    pronostico: summarize(emitted, 'pron'),
    pendiente: summarize(futuros, 'pron'),
    observadoVentana: summarize(observedRows, 'real'),
    contraste: {
      weeks: verif.length,
      pares: pares.length,
      first: verif.length ? verif[0].date : null,
      last: verif.length ? verif[verif.length - 1].date : null,
      real: pares.length ? pares.reduce((a, r) => a + r.real, 0) : null,
      pron: pares.length ? pares.reduce((a, r) => a + r.pron, 0) : null,
    },
  };
}

/** Distribución de motores asignados en la selección (padecimiento + sexo). */
export function motorDistribution(raw, index, sexo) {
  const counts = new Map();
  const byTipo = { nacional: 0, estado: 0, region: 0 };
  let total = 0;
  for (const entity of index.entities.values()) {
    const key = entity.keys[sexo];
    if (!key) continue;
    const motor = normalizeSeries(raw[key])?.motor ?? 'Sin dato';
    counts.set(motor, (counts.get(motor) ?? 0) + 1);
    byTipo[entity.tipo] = (byTipo[entity.tipo] ?? 0) + 1;
    total += 1;
  }
  const items = [...counts.entries()]
    .map(([motor, n]) => ({ motor, n, share: total ? n / total : 0 }))
    .sort((a, b) => b.n - a.n || a.motor.localeCompare(b.motor, 'es'));
  return { total, items, byTipo };
}

/** Ranking de las 32 entidades (sólo estados; el nacional y las regiones no compiten). */
export function rankEstados(raw, index, sexo, metric, ventana) {
  const list = ESTADOS.map((estado) => {
    const series = getSeries(raw, index, estado.slug, sexo);
    if (!series) return { ...estado, value: null, n: 0, first: null, last: null };
    const rows = buildRows(series);
    let s;
    if (metric === 'observado') {
      s = computeKpis(series, rows, applyWindow(rows, ventana, series)).observadoVentana;
    } else {
      s = computeKpis(series, rows, rows).pronostico;
    }
    return { ...estado, value: s.sum, n: s.n, first: s.first, last: s.last };
  });
  list.sort((a, b) => {
    if (a.value === null && b.value === null) return a.label.localeCompare(b.label, 'es');
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    return b.value - a.value || a.label.localeCompare(b.label, 'es');
  });
  let rank = 0;
  return list.map((item) => ({ ...item, rank: item.value === null ? null : ++rank }));
}

// ── Tabla: filtro por fase y paginación ─────────────────────────────────────
export const FASE_FILTROS = Object.freeze([
  { id: 'todas', label: 'Todas las fases' },
  ...Object.entries(FASES).map(([id, f]) => ({ id, label: f.label })),
].map(Object.freeze));

export const PAGE_SIZES = Object.freeze([12, 24]);

export function filterByFase(rows, fase) {
  return Object.hasOwn(FASES, fase) ? rows.filter((r) => r.fase === fase) : rows;
}

/** Página acotada a [1, pages]; tamaño restringido a PAGE_SIZES. */
export function paginate(rows, page, size) {
  const s = PAGE_SIZES.includes(size) ? size : PAGE_SIZES[0];
  const pages = Math.max(1, Math.ceil(rows.length / s));
  const p = Math.min(Math.max(1, Math.trunc(Number(page)) || 1), pages);
  const start = (p - 1) * s;
  const end = Math.min(start + s, rows.length);
  return { page: p, pages, size: s, start, end, total: rows.length, rows: rows.slice(start, end) };
}

// ── Escalas ─────────────────────────────────────────────────────────────────
/** Umbrales por cuantiles (k clases) sobre valores no nulos. */
export function quantileThresholds(values, k = 5) {
  const v = values.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return [];
  const t = [];
  for (let i = 1; i < k; i += 1) {
    const pos = (v.length - 1) * (i / k);
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    t.push(v[lo] + (v[hi] - v[lo]) * (pos - lo));
  }
  return t.filter((x, i, arr) => i === 0 || x > arr[i - 1]);
}

export function bucketOf(value, thresholds) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  let b = 0;
  while (b < thresholds.length && value > thresholds[b]) b += 1;
  return b;
}

/** Marcas "redondas" para un eje. Garantiza dominio que incluye min y max. */
export function niceTicks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    if (min === 0) return [0, 1];
    const pad = Math.abs(min) * 0.5;
    min -= pad; max += pad;
  }
  const raw = (max - min) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

// ── Formato ─────────────────────────────────────────────────────────────────
const NF0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const NF1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
const DF = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const DFM = new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit', timeZone: 'UTC' });

export function formatInt(n) {
  return n === null || n === undefined ? 'sin dato' : NF0.format(Math.round(n));
}
export function formatValue(n) {
  return n === null || n === undefined ? 'sin dato' : NF1.format(n);
}
export function formatDate(iso) {
  return iso ? DF.format(new Date(`${iso}T00:00:00Z`)).replace(/\./g, '') : 'sin fecha';
}
export function formatMonth(iso) {
  return DFM.format(new Date(`${iso}T00:00:00Z`)).replace(/\./g, '');
}
export function formatWeek(w) {
  return w ? `semana ${w.semana} de ${w.anio}` : 'sin dato';
}

// ── CSV ─────────────────────────────────────────────────────────────────────
export function csvField(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita fórmulas al abrir en hojas de cálculo
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_COLUMNS = Object.freeze([
  'fecha_indice_serie', 'fase', 'observado', 'pronostico', 'padecimiento', 'territorio', 'sexo',
  'motor', 'corte_modelo', 'ds_corte', 'ultimo_indice_observado', 'ultimo_boletin',
]);

/** CSV del recorte visible (ventana activa). null queda como celda vacía. */
export function toCSV(rows, meta) {
  const week = (w) => (w ? `${w.anio}-W${String(w.semana).padStart(2, '0')}` : null);
  const lines = [CSV_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push([
      row.date, FASES[row.fase].csv, row.real, row.pron,
      meta.padecimiento, meta.territorio, meta.sexo, meta.motor,
      week(meta.corteModelo), meta.dsCorte, meta.lastReal, week(meta.ultimaSemanaBoletin),
    ].map(csvField).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

export function csvFilename(state) {
  return `epiforecast_${[state.p, state.t, state.s, state.v].map(slugify).join('_')}.csv`;
}

// ── Estado en la URL ────────────────────────────────────────────────────────
export const DEFAULT_STATE = Object.freeze({
  p: 'depresion', s: 'general', t: 'nacional', v: 'todo', m: 'pronostico', archivo: false,
});

export function parseState(search) {
  const q = new URLSearchParams(search ?? '');
  const pick = (name, list) => {
    const v = q.get(name);
    return list.some((x) => x.id === v) ? v : DEFAULT_STATE[name];
  };
  const t = q.get('t');
  return {
    p: pick('p', PADECIMIENTOS),
    s: pick('s', SEXOS),
    t: t && /^[a-z0-9-]{1,64}$/.test(t) ? t : DEFAULT_STATE.t,
    v: pick('v', VENTANAS),
    m: pick('m', METRICAS),
    archivo: q.get('archivo') === 'tableau',
  };
}

export function serializeState(state) {
  const q = new URLSearchParams();
  for (const k of ['p', 's', 't', 'v', 'm']) q.set(k, state[k]);
  if (state.archivo) q.set('archivo', 'tableau');
  return `?${q.toString()}`;
}

// ── Mapa ────────────────────────────────────────────────────────────────────
const PATH_RE = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/;
export function isSafePath(d) {
  return typeof d === 'string' && d.length > 0 && d.length < 500000 && PATH_RE.test(d);
}

/** Valida mexico_paths.json y une cada geometría con su entidad. */
export function normalizeMap(json) {
  const viewBox = typeof json?.viewbox === 'string' && /^[\d.\s-]+$/.test(json.viewbox) ? json.viewbox : null;
  const states = [];
  const unknown = [];
  for (const [name, d] of Object.entries(json?.states ?? {})) {
    const slug = slugify(name);
    const estado = ESTADO_BY_SLUG.get(slug);
    if (!estado || !isSafePath(d)) { unknown.push(name); continue; }
    states.push({ slug, label: estado.label, d });
  }
  return { viewBox, states, unknown };
}

// ── EpiBot (referencia cruzada) ─────────────────────────────────────────────
/** casos_52_semanas_futuro publicado en EpiBot para la serie exacta, o null. */
export function knowledgeLookup(kb, padecimientoLabel, territorioLabel, sexo) {
  const models = Array.isArray(kb?.prod_models) ? kb.prod_models : [];
  const p = normName(padecimientoLabel), t = normName(territorioLabel);
  const hit = models.find((m) => normName(m?.padecimiento) === p && normName(m?.entidad) === t && m?.sexo === sexo);
  const v = toNum(hit?.casos_52_semanas_futuro);
  return v === null ? null : { value: v, motor: typeof hit.modelo_produccion === 'string' ? hit.modelo_produccion : null };
}

// ── Carga asíncrona ─────────────────────────────────────────────────────────
/** Caché por URL que comparte la promesa en curso y olvida los fallos (permite reintentar). */
export function createCachedLoader(fetchFn) {
  const cache = new Map();
  return function load(url) {
    if (!cache.has(url)) {
      const p = Promise.resolve()
        .then(() => fetchFn(url, { credentials: 'same-origin' }))
        .then((res) => {
          if (!res || !res.ok) throw new Error(`HTTP ${res ? res.status : 'sin respuesta'}`);
          return res.json();
        });
      cache.set(url, p);
      p.catch(() => { if (cache.get(url) === p) cache.delete(url); });
    }
    return cache.get(url);
  };
}

/** Testigo de "última petición": descarta respuestas de selecciones ya superadas. */
export function createLatest() {
  let seq = 0;
  return { next: () => ++seq, isCurrent: (token) => token === seq };
}
