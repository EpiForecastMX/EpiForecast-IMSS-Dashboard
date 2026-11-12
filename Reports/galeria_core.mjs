// galeria_core.mjs — lógica pura de la Galería de pronósticos (sin DOM ni red). Probada en
// tests/galeria.test.mjs. El controlador (galeria.mjs) sólo la conecta al documento.
//
// Contratos del piloto:
//   * Entrada por padecimiento: el inicio lee SÓLO assets/dashboard/catalog.json (cero vistas).
//   * Fuente por origen: un release carga su publication/<id>/vista.json (una por selección,
//     cacheada); la cohorte original (legacy) se lista desde la lista DATA de la página (PNG, sin
//     red) y su archivo zoom de cohorte se pide —una vez y compartido por los padecimientos de la
//     cohorte— sólo al abrir una gráfica viva en el visor.
//   * URL (mismos IDs que el dashboard): p = id del catálogo, s = sexo, t = territorio (slug del
//     dashboard) y dos parámetros propios: nivel (nacional|estatal|regional|todos, cuando no hay
//     t) y grafica (full|zoom|zoom5|compare). Nunca se escribe una búsqueda de texto (q) en la URL.
//   * Capacidades por origen, derivadas de kind (no se agregan campos a vistas ni zoom).
//   * Bandas sólo con intervalo_disponible === true; nunca se muestran métricas de error.

import { buildIndex, createCachedLoader, createLatest, COHORTS } from '../assets/dashboard/data.mjs';
import { normalizeDataset } from '../assets/dashboard/unified.mjs';

export { createCachedLoader, createLatest };

/**
 * Caché por URL que guarda el resultado YA VALIDADO. La validación corre dentro de la promesa
 * cacheada: un HTTP 200 con esquema inválido (o cualquier error) se olvida igual que un HTTP 5xx,
 * así que «Reintentar» vuelve a pedir el archivo. API aditiva: no toca createCachedLoader de
 * data.mjs, que comparte el dashboard. load(url, validate) → Promise<validate(json)>; la clave de
 * caché incluye un nombre opcional de validador para no mezclar resultados de validadores distintos.
 */
export function createValidatedLoader(fetchFn) {
  const cache = new Map();
  const load = (url, validate = (x) => x, name = '') => {
    const key = `${name}|${url}`;
    if (!cache.has(key)) {
      const p = Promise.resolve()
        .then(() => fetchFn(url, { credentials: 'same-origin', cache: 'no-cache' }))
        .then((res) => {
          if (!res || !res.ok) throw new Error(`HTTP ${res ? res.status : 'sin respuesta'}`);
          return res.json();
        })
        .then((json) => validate(json));
      cache.set(key, p);
      p.catch(() => { if (cache.get(key) === p) cache.delete(key); });
    }
    return cache.get(key);
  };
  load.size = () => cache.size;
  return load;
}

export const SEXOS = Object.freeze(['general', 'hombres', 'mujeres']);
export const SEXO_LABEL = Object.freeze({ general: 'General', hombres: 'Hombres', mujeres: 'Mujeres', todos: 'Todos' });
export const NIVELES = Object.freeze(['nacional', 'estatal', 'regional', 'todos']);
export const NIVEL_LABEL = Object.freeze({ nacional: 'Nacional', estatal: 'Estatal', regional: 'Regional', todos: 'Todos los niveles' });
const TIPO_DE_NIVEL = Object.freeze({ nacional: 'nacional', estatal: 'estado', regional: 'region' });
export const GRAFICAS = Object.freeze([
  Object.freeze({ id: 'full', label: 'Histórico', title: 'Serie histórica completa' }),
  Object.freeze({ id: 'zoom', label: 'Zoom 52 semanas', title: 'Últimas 52 semanas observadas y pronóstico a 52 semanas' }),
  Object.freeze({ id: 'zoom5', label: 'Zoom 5 años', title: 'Cinco años observados y pronóstico a 52 semanas' }),
  Object.freeze({ id: 'compare', label: 'Comparar modelos', title: '52 semanas atrás y adelante con los motores superpuestos' }),
]);
export const STATUS_SHORT = Object.freeze({
  pass: 'Validación prospectiva superada',
  pending: 'Validación prospectiva en curso',
  control: 'Control estacional publicado',
  legacy: 'Cohorte original',
});
export const PAGE_SIZE = 24;
const ID_RE = /^[a-z0-9_]{1,80}$/;
const SLUG_RE = /^[a-z0-9-]{1,64}$/;
const PNG_SUFFIX = Object.freeze({ zoom: '_zoom.png', zoom5: '_zoom5.png', compare: '_compare.png' });

/** Sin tildes, minúsculas y espacios simples: la misma búsqueda para legacy y releases. */
export function normalizeText(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** ¿Todas las palabras de la consulta aparecen en el texto? (consulta y texto se normalizan). */
export function matchesQuery(text, query) {
  const q = normalizeText(query);
  if (!q) return true;
  const t = normalizeText(text);
  return q.split(' ').every((part) => t.includes(part));
}

/**
 * Sólo rutas relativas del sitio (nunca esquemas ni hosts). La galería vive en Reports/, así que se
 * admite UN «../» inicial (subir a la raíz del sitio) y ningún «..» más.
 */
export function safeHref(u) {
  if (typeof u !== 'string') return null;
  const rest = u.startsWith('../') ? u.slice(3) : u;
  return /^[A-Za-z0-9_][A-Za-z0-9_./?=&%#|-]*$/.test(rest) && !rest.includes('..') ? u : null;
}

/** encodeURIComponent que además codifica ! ' ( ) * (que el estándar deja pasar). */
export function encodeParam(s) {
  return encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Ficha de una serie de release: página del catálogo + ?serie=<clave codificada>. */
export function fichaHref(entry, key, base = '../') {
  return safeHref(`${base}${entry.page}?serie=${encodeParam(key)}`);
}

/** Color con alfa para Chart.js a partir de #rgb, #rrggbb o rgb(); cae a gris si no lo reconoce. */
export function withAlpha(color, a) {
  const c = String(color).trim();
  let r, g, b;
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) [r, g, b] = [...m[1]].map((x) => parseInt(x + x, 16));
  else if ((m = /^#([0-9a-f]{6})$/i.exec(c))) [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  else if ((m = /^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(c))) [r, g, b] = m.slice(1, 4).map(Number);
  else [r, g, b] = [97, 117, 108];
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const NF0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const NF1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
/** Casos para mostrar: enteros tal cual; fraccionarios (releases sin redondeo) con hasta 1 decimal. */
export function fmtCasos(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'sin dato';
  return Number.isInteger(v) ? NF0.format(v) : (Math.abs(v) < 0.05 && v !== 0 ? '< 0.1' : NF1.format(v));
}

/** Semana exacta para el tooltip: «semana del 12 nov 2026». */
export function fechaSemana(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? String(iso)
    : `semana del ${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
}

// ── Capacidades por origen ───────────────────────────────────────────────────
/**
 * Qué ofrece la Galería para un padecimiento, derivado de kind y de las banderas ya publicadas.
 * Cada opción no soportada queda deshabilitada CON motivo; nada se oculta en silencio.
 */
export function capabilities(entry) {
  const legacy = entry?.kind === 'legacy';
  const graficas = GRAFICAS.map((g) => {
    if (legacy) return { ...g, enabled: true, reason: null };
    if (g.id === 'full' || g.id === 'zoom') return { ...g, enabled: true, reason: null };
    return {
      ...g,
      enabled: false,
      reason: g.id === 'zoom5'
        ? 'No disponible: la publicación de este padecimiento se dibuja en vivo desde su vista, sin láminas de 5 años.'
        : 'No disponible: la vista publicada trae un solo pronóstico por serie; no publica motores alternativos para comparar.',
    };
  });
  const sexes = Array.isArray(entry?.sexes) ? entry.sexes.filter((s) => SEXOS.includes(s)) : [];
  return {
    graficas,
    sexo: sexes.length > 1
      ? { enabled: true, options: [...sexes, 'todos'], reason: null }
      : { enabled: false, options: sexes, reason: 'El boletín no desglosa este padecimiento por sexo: sólo hay total (General).' },
    intervalo: legacy ? 'Sólo en las series cuyo motor produce intervalo.' : 'Pronóstico puntual, sin intervalos.',
    tarjeta: legacy ? 'png' : 'viva',
    visor: legacy ? 'Lámina PNG; en «Zoom 52 semanas», gráfica viva desde el archivo de la cohorte.' : 'Gráfica viva desde la vista publicada.',
    ficha: legacy ? null : entry.page,
  };
}

export function graficaEnabled(entry, id) {
  return capabilities(entry).graficas.some((g) => g.id === id && g.enabled);
}

// ── Estado en la URL ─────────────────────────────────────────────────────────
export const DEFAULT_DETAIL = Object.freeze({ s: 'general', t: 'nacional', nivel: 'nacional', grafica: 'full' });

/**
 * Lee la URL contra el catálogo. Devuelve {state, problems}; problems explica cada parámetro
 * descartado (la UI lo muestra con un botón para limpiar). t sólo se valida en forma aquí: su
 * existencia depende de la fuente y se comprueba con resolveTerritory tras cargarla.
 */
export function parseGalleryState(search, catalog) {
  const q = new URLSearchParams(search ?? '');
  const problems = [];
  const state = { p: null, ...DEFAULT_DETAIL };
  const pRaw = q.get('p');
  if (pRaw === null || pRaw === '') return { state, problems };
  const entry = ID_RE.test(pRaw) ? catalog?.diseases?.find((d) => d.id === pRaw) : null;
  if (!entry) {
    problems.push({ param: 'p', value: pRaw, message: `El padecimiento «${pRaw}» no está en el catálogo publicado.` });
    return { state, problems };
  }
  state.p = entry.id;
  const caps = capabilities(entry);
  const s = q.get('s');
  if (s !== null) {
    if (caps.sexo.options.includes(s)) state.s = s;
    else problems.push({ param: 's', value: s, message: `El sexo «${s}» no existe para ${entry.labelShort}; se muestra General.` });
  }
  if (!caps.sexo.options.includes(state.s)) state.s = caps.sexo.options[0];
  const nivel = q.get('nivel');
  const t = q.get('t');
  if (t !== null && t !== '') {
    if (SLUG_RE.test(t)) state.t = t;
    else problems.push({ param: 't', value: t, message: `El territorio «${t}» no es válido; se muestra el total nacional.` });
  } else if (nivel !== null) {
    if (NIVELES.includes(nivel)) { state.t = ''; state.nivel = nivel; } else {
      problems.push({ param: 'nivel', value: nivel, message: `El nivel «${nivel}» no es válido; se muestra el total nacional.` });
    }
  }
  const g = q.get('grafica');
  if (g !== null) {
    if (graficaEnabled(entry, g)) state.grafica = g;
    else {
      const known = GRAFICAS.find((x) => x.id === g);
      problems.push({ param: 'grafica', value: g, message: known
        ? `La vista «${known.label}» no está disponible para ${entry.labelShort}; se muestra el histórico.`
        : `La vista «${g}» no existe; se muestra el histórico.` });
    }
  }
  return { state, problems };
}

/** URL de la Galería para un estado. Sin padecimiento, sin parámetros. Nunca incluye q. */
export function serializeGalleryState(st) {
  if (!st?.p) return '';
  const q = new URLSearchParams();
  q.set('p', st.p);
  q.set('s', st.s);
  if (st.t) q.set('t', st.t); else q.set('nivel', st.nivel);
  if (st.grafica && st.grafica !== 'full') q.set('grafica', st.grafica);
  return `?${q.toString()}`;
}

/** Enlace al dashboard con la misma selección (sólo si hay una serie concreta). */
export function dashboardHref(st, base = '../') {
  if (!st?.p) return `${base}EpiDashboard.html`;
  const q = new URLSearchParams({ vista: 'explorar', p: st.p });
  if (SEXOS.includes(st.s)) q.set('s', st.s);
  if (st.t) q.set('t', st.t);
  return `${base}EpiDashboard.html?${q.toString()}`;
}

// ── Fuentes ──────────────────────────────────────────────────────────────────
/** URL (relativa a Reports/) de la fuente de un padecimiento: vista del release o zoom de cohorte. */
export function sourceUrl(entry, base = '../') {
  if (entry.kind === 'legacy') return base + (COHORTS[entry.cohort] ?? entry.url);
  return base + entry.url;
}

/**
 * Fuente normalizada de un padecimiento: {entry, kind, entities: Map slug→{slug,tipo,label,keys}, item(key)}.
 * legacy: índice desde DATA (las láminas publicadas), sin red. release: normalizeDataset sobre la vista.
 */
export function legacySource(entry, data) {
  const raw = Object.fromEntries((data || []).map((d) => [d.f, d]));
  const { entities } = buildIndex(raw, entry.id);
  if (!entities.size) throw new Error(`la lista DATA no tiene láminas de ${entry.label}`);
  let n = 0;
  for (const e of entities.values()) n += Object.keys(e.keys).length;
  if (n !== entry.nSeries) throw new Error(`${entry.label}: ${n} láminas frente a ${entry.nSeries} series del catálogo`);
  return { entry, kind: 'legacy', entities, item: (key) => raw[key] ?? null };
}

export function releaseSource(entry, vista) {
  const ds = normalizeDataset(entry, vista);
  return { entry, kind: 'release', entities: ds.index.entities, item: (key) => ds.raw[key] ?? null, metadata: ds.metadata };
}

/** Territorio pedido si existe en la fuente; si no, nacional con aviso. */
export function resolveTerritory(source, t) {
  if (!t || source.entities.has(t)) return { t, fallback: false };
  return { t: 'nacional', fallback: true };
}

/**
 * Series visibles con un filtro, en orden nacional → estados (orden oficial) → regiones y
 * General → Hombres → Mujeres. Cada una: {key, slug, tipo, label, sexo}.
 */
export function listSeries(source, { t = 'nacional', nivel = 'nacional', s = 'general', q = '' } = {}) {
  const tipo = t ? null : TIPO_DE_NIVEL[nivel] ?? null;
  const out = [];
  for (const e of source.entities.values()) {
    if (t && e.slug !== t) continue;
    if (!t && tipo && e.tipo !== tipo) continue;
    if (q && !matchesQuery(`${e.label} ${source.entry.label} ${source.entry.cie ?? ''}`, q)) continue;
    for (const sx of SEXOS) {
      if (!e.keys[sx] || (s !== 'todos' && s !== sx)) continue;
      out.push({ key: e.keys[sx], slug: e.slug, tipo: e.tipo, label: e.label, sexo: sx, entry: source.entry });
    }
  }
  return out;
}

/** Territorios de la fuente agrupados para un <select>. */
export function territoryGroups(source) {
  const groups = { nacional: [], estado: [], region: [] };
  for (const e of source.entities.values()) (groups[e.tipo] ?? []).push({ slug: e.slug, label: e.label });
  return [
    { label: 'Nacional', items: groups.nacional },
    { label: 'Entidades federativas', items: groups.estado },
    { label: 'Regiones', items: groups.region },
  ].filter((g) => g.items.length);
}

// ── Gráficas ─────────────────────────────────────────────────────────────────
/** Ruta de la lámina PNG de una serie legacy para una vista (relativa a Reports/). */
export function pngFor(dataItem, grafica) {
  const suf = PNG_SUFFIX[grafica];
  return suf ? dataItem.f.replace(/\.png$/, suf) : dataItem.f;
}

/** Ventana de una serie viva ({d, r, y}): histórico completo o 52 semanas antes del pronóstico + pronóstico. */
export function ventana(serie, grafica) {
  const d = serie.d;
  const meta = { ds_corte: serie.ds_corte ?? null, intervalo_disponible: serie.intervalo_disponible === true, motor: serie.motor };
  if (grafica !== 'zoom') return { ...meta, d, r: serie.r, y: serie.y, lo: serie.lo ?? null, hi: serie.hi ?? null };
  const first = serie.y.findIndex((v, i) => v != null && (!serie.ds_corte || d[i] > serie.ds_corte));
  const from = first < 0 ? Math.max(0, d.length - 104) : Math.max(0, first - 52);
  const cut = (a) => (Array.isArray(a) ? a.slice(from) : null);
  return { ...meta, d: d.slice(from), r: cut(serie.r), y: cut(serie.y), lo: cut(serie.lo), hi: cut(serie.hi) };
}

/** ¿Se puede dibujar banda? Sólo con bandera explícita y valores presentes. */
export function bandaPermitida(serie) {
  if (!serie || serie.intervalo_disponible !== true) return false;
  const tiene = (a) => Array.isArray(a) && a.some((v) => v != null);
  return tiene(serie.lo) && tiene(serie.hi);
}

// ── Paginación y carga progresiva ────────────────────────────────────────────
export function pageOf(list, page, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const p = Math.min(Math.max(1, Math.trunc(Number(page)) || 1), pages);
  return { page: p, pages, items: list.slice((p - 1) * size, p * size), total: list.length };
}

/**
 * Carga todas las fuentes de una lista de padecimientos con concurrencia acotada. Informa el
 * progreso por origen; un fallo no detiene a los demás; `signal.aborted` cancela lo pendiente.
 * Devuelve {ok: Map id→fuente, errors: Map id→Error, cancelled}.
 */
export async function loadAll(entries, loadOne, { concurrency = 3, signal = null, onProgress = () => {} } = {}) {
  const ok = new Map();
  const errors = new Map();
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < entries.length) {
      if (signal?.aborted) return;
      const e = entries[next++];
      try { ok.set(e.id, await loadOne(e)); } catch (err) { errors.set(e.id, err); }
      done += 1;
      onProgress({ done, total: entries.length, id: e.id, error: errors.get(e.id) ?? null });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));
  return { ok, errors, cancelled: Boolean(signal?.aborted) && done < entries.length };
}

/**
 * Pool de gráficas vivas: a lo sumo `limit` a la vez. sync() libera las de lienzos que ya no
 * están en el documento; request() crea una si cabe o libera la usada hace más tiempo.
 */
export function createChartPool({ limit = 24, create, destroy }) {
  const live = new Map(); // canvas → {chart, t}
  let clock = 0;
  return {
    get size() { return live.size; },
    has: (c) => live.has(c),
    sync() {
      for (const [c, v] of live) if (!c.isConnected) { destroy(v.chart); live.delete(c); }
    },
    request(canvas) {
      if (live.has(canvas)) { live.get(canvas).t = ++clock; return live.get(canvas).chart; }
      this.sync();
      while (live.size >= limit) {
        let oldest = null;
        for (const [c, v] of live) if (!oldest || v.t < oldest[1].t) oldest = [c, v];
        destroy(oldest[1].chart); live.delete(oldest[0]);
      }
      const chart = create(canvas);
      live.set(canvas, { chart, t: ++clock });
      return chart;
    },
    clear() { for (const v of live.values()) destroy(v.chart); live.clear(); },
  };
}

// ── Color presentacional ─────────────────────────────────────────────────────
const LEGACY_SLOT = Object.freeze({ depresion: 1, parkinson: 2, alzheimer: 3, dengue: 4 });
/** Ranura 1..8 de --series-* por clave (mismo algoritmo que EpiPreview.slotFor de la portada). */
export function seriesSlot(key) {
  if (Object.hasOwn(LEGACY_SLOT, key)) return LEGACY_SLOT[key];
  let h = 0;
  for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 8) + 1;
}

// ── Textos ───────────────────────────────────────────────────────────────────
const semanaTxt = (w) => (w && Number.isInteger(w.semana) ? `semana ${w.semana} de ${w.anio}` : 'sin dato');

/** Metadatos visibles de un padecimiento (origen, emisión, observado, estado) sin inferencias. */
export const LEGACY_STATUS = 'Cohorte original: pronóstico a 52 semanas desde el corte, con valores redondeados. Sin validación prospectiva declarada en el catálogo.';

/**
 * Metadatos visibles de un padecimiento sin inferencias. `estadoDetalle` no repite el rótulo corto
 * (la etiqueta publicada de un release suele empezar por él).
 */
export function entryFacts(entry) {
  const legacy = entry.kind === 'legacy';
  const corto = STATUS_SHORT[entry.status?.kind] ?? 'Sin estado';
  const label = legacy ? LEGACY_STATUS : String(entry.status?.label ?? '');
  const detalle = label.startsWith(corto) ? label.slice(corto.length).replace(/^[\s·:,-]+/, '') : label;
  return {
    estadoCorto: corto,
    estado: label,
    estadoDetalle: detalle,
    corte: semanaTxt(entry.origin),
    corteRotulo: legacy ? 'Corte del modelo' : 'Datos del pronóstico hasta',
    origen: legacy ? `corte del modelo: ${semanaTxt(entry.origin)}` : `pronóstico con datos hasta la ${semanaTxt(entry.origin)}`,
    observado: semanaTxt(entry.lastObservation),
    emision: entry.emittedAt
      ? new Date(entry.emittedAt).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'long', year: 'numeric' })
      : 'fecha no documentada',
    redondeo: legacy ? 'Valores redondeados a casos enteros.' : 'Valores sin redondear.',
    unidades: 'Casos notificados por semana',
    series: entry.nSeries,
    sexos: entry.sexes.map((s) => SEXO_LABEL[s]).join(', '),
  };
}

/** Resumen por origen para el encabezado del catálogo. */
export function catalogSummary(catalog) {
  const by = { legacy: { n: 0, series: 0 }, release: { n: 0, series: 0 } };
  for (const d of catalog.diseases) { by[d.kind].n += 1; by[d.kind].series += d.nSeries; }
  return { diseases: catalog.diseases.length, series: by.legacy.series + by.release.series, legacy: by.legacy, release: by.release };
}
