// unified.mjs: catálogo unificado (4 legacy + releases publicados) y adaptadores de datos.
// Puro: sin DOM ni red. Reutiliza las funciones genéricas de data.mjs sin modificarlas.
//
// Reglas que este módulo hace cumplir:
//   * legacy (zoom visual redondeado) y release (vista publicada) viven en adaptadores propios;
//   * sólo miembros lifecycle=published, mode=public, visible!==false y canal web si se declara;
//     gallery_enabled NO filtra;
//   * estado, semanas, origen, corte y emisión de un release salen de SU vista actual;
//     vista ausente, identidad distinta, esquema desconocido o veredicto FAIL fallan cerrados;
//   * los controles (verdict INCOMPLETE con publication_label de control estacional) se
//     distinguen como 'control', nunca como validación en curso;
//   * null = sin dato, 0 es valor real y los negativos se conservan;
//   * nunca se suman casos de padecimientos distintos.

import {
  PADECIMIENTOS, COHORTS, SEXOS, ESTADOS,
  buildIndex, entityInfo, normalizeSeries, buildRows, computeKpis, slugify,
} from './data.mjs';

export const CATALOG_SCHEMA = 'epidashboard.catalog.v2';
export const VIEW_SCHEMA = 'publication_view.v1';
export const PUBLICATION_SCHEMA = 'publication_install.v1';
export const SPARK_WEEKS = 26;

const SEX_IDS = SEXOS.map((s) => s.id);
const STATUS_KINDS = Object.freeze(['legacy', 'control', 'pending', 'pass']);
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[a-z0-9_]{1,80}$/;

/** Datos fijos de los cuatro padecimientos legacy (labels/CIE ya publicados en el sitio). */
export const LEGACY_META = Object.freeze({
  depresion: Object.freeze({ cie: 'F32', page: 'bitacora_modelado.html' }),
  parkinson: Object.freeze({ cie: 'G20', page: 'bitacora_modelado.html' }),
  alzheimer: Object.freeze({ cie: 'G30', page: 'bitacora_modelado.html' }),
  dengue: Object.freeze({ cie: 'A97', page: 'dengue.html' }),
});

export const LEGACY_STATUS_LABEL =
  'Publicación previa: pronóstico de 52 semanas desde el JSON visual (valores redondeados), sin validación prospectiva en este tablero';

export const TOTAL_SOURCES = Object.freeze({
  legacy: 'suma_json_visual_redondeado',
  canonical: 'pronostico_52_total',
  sum: 'suma_puntos_vista_sin_redondear',
});

export const DERIVED_NOTE =
  'Los productos con motor "portfolio" se tratan como derivados de productos base: no son modelos entrenados independientes. Los niveles nacional y regional de un release no son estimaciones independientes de los estatales.';

export const GROUPS = Object.freeze({
  legacy: 'Publicación previa (neurología y dengue)',
  tumores: 'Tumores malignos',
  otros: 'Otros padecimientos',
});

// ── utilidades ──────────────────────────────────────────────────────────────
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isIso = (v) => typeof v === 'string' && ISO_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const fail = (msg) => { throw new Error(`[unified] ${msg}`); };

export function addDaysIso(iso, days) {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}

function weekFromTuple(v, what) {
  if (Array.isArray(v) && v.length === 2 && Number.isInteger(v[0]) && Number.isInteger(v[1])
    && v[1] >= 1 && v[1] <= 53) return { anio: v[0], semana: v[1] };
  if (v && Number.isInteger(v.anio) && Number.isInteger(v.semana)) return { anio: v.anio, semana: v.semana };
  return fail(`semana inválida en ${what}`);
}

/** CIE: campo explícito o último paréntesis del nombre completo. */
export function extractCie(view) {
  if (typeof view?.cie === 'string' && view.cie.trim()) return view.cie.trim();
  const m = /\(([^()]+)\)\s*$/.exec(String(view?.nombre_completo ?? ''));
  return m ? m[1].trim() : null;
}

function groupFor(kind, cie) {
  if (kind === 'legacy') return GROUPS.legacy;
  return /^C\d/.test(cie ?? '') ? GROUPS.tumores : GROUPS.otros;
}

// ── selección de miembros ───────────────────────────────────────────────────
const RELEASE_ID_RE = /^[A-Za-z0-9_.-]{1,160}$/;

/**
 * Elegibilidad para el tablero: lifecycle=published, mode=public, visible!==false y canal web
 * si `channels` se declara. gallery_enabled no participa. NO valida identidad: un miembro elegible
 * con identidad malformada debe fallar en assertMemberIdentity, no desaparecer.
 * Lanza si el registro no es objeto o si `channels` declarado no es lista de cadenas.
 */
export function isEligibleMember(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) fail('registro de publicación no es objeto');
  if (m.channels !== undefined
    && (!Array.isArray(m.channels) || m.channels.some((c) => typeof c !== 'string'))) {
    fail(`channels inválido en ${String(m.disease_id)}: se esperaba lista de cadenas`);
  }
  if (m.lifecycle !== 'published' || m.mode !== 'public' || m.visible === false) return false;
  if (Array.isArray(m.channels) && !m.channels.includes('web')) return false;
  return true;
}

/** Alias histórico: sólo elegibilidad (ver isEligibleMember). */
export const isPublishedMember = isEligibleMember;

/** Identidad obligatoria de un miembro elegible. Lanza si falta o es inválida. */
export function assertMemberIdentity(m) {
  if (typeof m.disease_id !== 'string' || !ID_RE.test(m.disease_id)) {
    fail(`miembro publicado con disease_id ausente o inválido: ${JSON.stringify(m.disease_id ?? null)}`);
  }
  if (typeof m.release_id !== 'string' || !RELEASE_ID_RE.test(m.release_id)) {
    fail(`miembro publicado ${m.disease_id} con release_id ausente o inválido: ${JSON.stringify(m.release_id ?? null)}`);
  }
  return m;
}

export function selectPublishedMembers(publication) {
  if (!publication || !Array.isArray(publication.releases)) fail('catálogo de publicación sin releases');
  if (publication.schema !== undefined && publication.schema !== PUBLICATION_SCHEMA) {
    fail(`esquema de publicación desconocido: ${publication.schema}`);
  }
  const seen = new Set();
  const seenRelease = new Set();
  const out = [];
  for (const m of publication.releases) {
    if (!isEligibleMember(m)) continue;
    assertMemberIdentity(m);
    if (seen.has(m.disease_id)) fail(`disease_id duplicado en publicación: ${m.disease_id}`);
    if (seenRelease.has(m.release_id)) fail(`release_id duplicado en publicación: ${m.release_id}`);
    seen.add(m.disease_id);
    seenRelease.add(m.release_id);
    out.push(m);
  }
  return out.sort((a, b) => (a.disease_id < b.disease_id ? -1 : a.disease_id > b.disease_id ? 1 : 0));
}

// ── estado de publicación desde la vista ────────────────────────────────────
const CONTROL_RE = /control estacional/i;

/** Estado visible desde LA VISTA actual. FAIL o veredictos desconocidos lanzan. */
export function statusFromView(view) {
  const verdict = view?.verdict;
  const label = typeof view?.publication_label === 'string' ? view.publication_label : '';
  if (!label) fail(`vista ${view?.disease_id} sin publication_label`);
  const weeksAvailable = view.weeks_available;
  const weeksRequired = view.weeks_required;
  if (!Number.isInteger(weeksAvailable) || !Number.isInteger(weeksRequired)) {
    fail(`vista ${view.disease_id} sin weeks_available/weeks_required enteros`);
  }
  // Contrato canónico (epibot/scripts/lib/candidate.mjs VERDICTS): INCOMPLETE, PASS, FAIL, CONTROL_ONLY.
  // CONTROL_ONLY es siempre control (aunque traiga 4/4), nunca pass; verdict y label se conservan literales.
  let kind;
  if (verdict === 'FAIL') fail(`vista ${view.disease_id} con veredicto FAIL: no se publica en el tablero`);
  else if (verdict === 'PASS') kind = 'pass';
  else if (verdict === 'CONTROL_ONLY') kind = 'control';
  else if (verdict === 'INCOMPLETE') kind = CONTROL_RE.test(label) ? 'control' : 'pending';
  else fail(`vista ${view.disease_id} con veredicto desconocido: ${verdict}`);
  return { kind, label, verdict, weeksAvailable, weeksRequired };
}

// ── validación de vista ─────────────────────────────────────────────────────
function checkPairs(list, what) {
  if (!Array.isArray(list)) fail(`${what}: se esperaba lista de pares [fecha, valor]`);
  let prev = null;
  for (const p of list) {
    if (!Array.isArray(p) || p.length !== 2 || !isIso(p[0])) fail(`${what}: par inválido`);
    if (p[1] !== null && !isNum(p[1])) fail(`${what}: valor no numérico en ${p[0]}`);
    if (prev !== null && p[0] <= prev) fail(`${what}: fechas no estrictamente crecientes en ${p[0]}`);
    prev = p[0];
  }
  return list;
}

/** Comprueba esquema e identidad de la vista contra el miembro del catálogo. */
export function assertView(view, member) {
  if (!view || typeof view !== 'object') fail(`vista ausente para ${member.disease_id}`);
  if (view.schema !== VIEW_SCHEMA) fail(`vista ${member.disease_id} con esquema ${view.schema}`);
  if (view.disease_id !== member.disease_id) fail(`vista ${member.disease_id}: disease_id ${view.disease_id} no coincide`);
  if (view.release_id !== member.release_id) fail(`vista ${member.disease_id}: release_id ${view.release_id} no coincide con ${member.release_id}`);
  if (!view.series || typeof view.series !== 'object' || !Object.keys(view.series).length) {
    fail(`vista ${member.disease_id} sin series`);
  }
  return view;
}

function seriesEntityInfo(s, key) {
  const nivel = s?.nivel;
  let info;
  if (nivel === 'nacional') info = { slug: 'nacional', tipo: 'nacional', label: 'Nacional' };
  else if (nivel === 'estado' || nivel === 'region') {
    info = entityInfo(String(s.nombre ?? '').replace(/ /g, '_'));
    if (nivel === 'region' && info && info.tipo !== 'region') {
      const slug = `region-${slugify(s.nombre || s.id)}`;
      info = { slug, tipo: 'region', label: String(s.nombre || s.id) };
    }
    if (nivel === 'region' && info) info = { ...info, label: String(s.nombre || info.label) };
  }
  if (!info || info.tipo !== nivel) fail(`serie ${key}: territorio "${s?.nombre}" (${nivel}) no reconocido`);
  return info;
}

// ── catálogo ────────────────────────────────────────────────────────────────
function sparkOf(pairs) {
  return pairs.filter(([, v]) => isNum(v)).slice(-SPARK_WEEKS).map(([d, v]) => [d, v]);
}

function legacyEntry(pad, raw) {
  const meta = LEGACY_META[pad.id];
  if (!meta) fail(`legacy ${pad.id} sin metadatos`);
  if (!raw || typeof raw !== 'object') fail(`zoom ${pad.cohort} ausente para ${pad.id}`);
  const index = buildIndex(raw, pad.id);
  const nac = index.entities.get('nacional');
  if (!nac) fail(`legacy ${pad.id} sin serie nacional`);
  let nSeries = 0;
  const sexes = new Set();
  for (const e of index.entities.values()) {
    for (const sx of SEX_IDS) {
      if (!e.keys[sx]) continue;
      if (!normalizeSeries(raw[e.keys[sx]])) fail(`legacy ${pad.id}/${e.slug}/${sx} sin fechas válidas`);
      nSeries += 1;
      sexes.add(sx);
    }
  }
  const national = {};
  let ref = null;
  for (const sx of SEX_IDS) {
    if (!nac.keys[sx]) continue;
    const s = normalizeSeries(raw[nac.keys[sx]]);
    const rows = buildRows(s);
    const k = computeKpis(s, rows, rows).pronostico;
    const observed = rows
      .filter((r) => r.real !== null && (s.lastReal ? r.date <= s.lastReal : r.fase === 'observado'))
      .map((r) => [r.date, r.real]);
    national[sx] = {
      forecastTotal: k.sum, forecastN: k.n, start: k.first, end: k.last,
      forecastTotalSource: TOTAL_SOURCES.legacy, motor: s.motor,
      spark: sparkOf(observed),
    };
    if (sx === 'general' || !ref) ref = s;
  }
  return {
    id: pad.id,
    label: pad.label,
    labelShort: pad.label,
    cie: meta.cie,
    kind: 'legacy',
    cohort: pad.cohort,
    group: groupFor('legacy'),
    url: COHORTS[pad.cohort],
    page: meta.page,
    releaseId: null,
    nSeries,
    sexes: SEX_IDS.filter((s) => sexes.has(s)),
    status: { kind: 'legacy', label: LEGACY_STATUS_LABEL, verdict: null, weeksAvailable: null, weeksRequired: null },
    origin: ref.corteModelo,
    lastObservation: ref.ultimaSemanaBoletin,
    lastIndex: ref.lastReal,
    emittedAt: null,
    valuesRounded: true,
    national,
  };
}

function releaseEntry(member, view) {
  assertView(view, member);
  const status = statusFromView(view);
  const label = String(view.nombre_completo || view.display_name || member.disease_id);
  const labelShort = String(view.display_name || view.nombre_completo || member.disease_id);
  const cie = extractCie(view);
  const sexes = new Set();
  const seenSlotKeys = new Set();
  const national = {};
  let portfolio = 0;
  for (const [key, s] of Object.entries(view.series)) {
    const info = seriesEntityInfo(s, key);
    if (!SEX_IDS.includes(s.sexo)) fail(`serie ${key}: sexo desconocido ${s.sexo}`);
    const slot = `${info.slug}|${s.sexo}`;
    if (seenSlotKeys.has(slot)) fail(`serie duplicada ${slot} en ${member.disease_id}`);
    seenSlotKeys.add(slot);
    checkPairs(s.observado, `${member.disease_id}/${key}/observado`);
    checkPairs(s.pronostico, `${member.disease_id}/${key}/pronostico`);
    sexes.add(s.sexo);
    if (s.motor === 'portfolio') portfolio += 1;
    if (info.tipo === 'nacional') {
      const pts = s.pronostico.filter(([, v]) => isNum(v));
      const canonical = isNum(s.pronostico_52_total);
      national[s.sexo] = {
        forecastTotal: canonical ? s.pronostico_52_total : (pts.length ? pts.reduce((a, [, v]) => a + v, 0) : null),
        forecastN: pts.length,
        start: s.pronostico.length ? s.pronostico[0][0] : null,
        end: s.pronostico.length ? s.pronostico[s.pronostico.length - 1][0] : null,
        forecastTotalSource: canonical ? TOTAL_SOURCES.canonical : TOTAL_SOURCES.sum,
        motor: typeof s.motor === 'string' ? s.motor : 'Sin dato',
        spark: sparkOf(s.observado),
      };
    }
  }
  if (!national.general && !Object.keys(national).length) fail(`vista ${member.disease_id} sin serie nacional`);
  const nSeries = seenSlotKeys.size;
  if (Number.isInteger(view.products) && view.products !== nSeries) {
    fail(`vista ${member.disease_id}: products=${view.products} pero hay ${nSeries} series`);
  }
  if (!isIso(view.observation_cutoff_ds)) fail(`vista ${member.disease_id} sin observation_cutoff_ds`);
  if (typeof view.forecast_emitted_at !== 'string' || !view.forecast_emitted_at) {
    fail(`vista ${member.disease_id} sin forecast_emitted_at`);
  }
  const orderedNational = {};
  for (const sx of SEX_IDS) if (national[sx]) orderedNational[sx] = national[sx];
  return {
    id: member.disease_id,
    label,
    labelShort,
    cie,
    kind: 'release',
    cohort: 'release',
    group: groupFor('release', cie),
    url: `publication/${member.disease_id}/vista.json`,
    page: `${member.disease_id}.html`,
    releaseId: member.release_id,
    nSeries,
    sexes: SEX_IDS.filter((s) => sexes.has(s)),
    status,
    origin: weekFromTuple(view.origin, `${member.disease_id}.origin`),
    lastObservation: weekFromTuple(view.observation_cutoff, `${member.disease_id}.observation_cutoff`),
    lastIndex: view.observation_cutoff_ds,
    emittedAt: view.forecast_emitted_at,
    valuesRounded: false,
    horizonWeeks: Number.isInteger(view.horizon_weeks) ? view.horizon_weeks : null,
    uncertaintyLabel: typeof view.uncertainty_label === 'string' ? view.uncertainty_label : null,
    observationDatasetId: typeof view.observation_dataset_id === 'string' ? view.observation_dataset_id : null,
    derived: {
      models: Number.isInteger(view.models) ? view.models : null,
      products: nSeries,
      portfolioProducts: portfolio,
    },
    national: orderedNational,
  };
}

function summarizeCatalog(diseases) {
  const statusCounts = Object.fromEntries(STATUS_KINDS.map((k) => [k, 0]));
  for (const d of diseases) statusCounts[d.status.kind] += 1;
  return {
    diseases: diseases.length,
    legacy: diseases.filter((d) => d.kind === 'legacy').length,
    release: diseases.filter((d) => d.kind === 'release').length,
    series: diseases.reduce((a, d) => a + d.nSeries, 0),
    statusCounts,
  };
}

/**
 * Catálogo unificado. Puro.
 * legacy: {neuro, dengue} (JSON zoom), publication: publication/catalog.json,
 * views: {disease_id: vista.json}. Toda vista de un miembro publicado es obligatoria.
 */
export function makeCatalog({ legacy, publication, views } = {}) {
  const diseases = [];
  for (const pad of PADECIMIENTOS) diseases.push(legacyEntry(pad, legacy?.[pad.cohort]));
  const legacyIds = new Set(diseases.map((d) => d.id));
  for (const member of selectPublishedMembers(publication)) {
    if (legacyIds.has(member.disease_id)) fail(`release ${member.disease_id} colisiona con un legacy`);
    const view = views && Object.hasOwn(views, member.disease_id) ? views[member.disease_id] : null;
    if (!view) fail(`vista ausente para ${member.disease_id}: no se omite en silencio`);
    diseases.push(releaseEntry(member, view));
  }
  return validateCatalog({ schema: CATALOG_SCHEMA, diseases, summary: summarizeCatalog(diseases) });
}

// ── validación del catálogo (cliente y builder) ─────────────────────────────
const SAFE_URL_RE = /^(?![a-z][a-z0-9+.-]*:)(?!\/)(?!.*\.\.)[A-Za-z0-9_./-]+$/;

function checkWeek(w, where) {
  if (w === null) return;
  if (!w || !Number.isInteger(w.anio) || !Number.isInteger(w.semana)) fail(`${where}: semana inválida`);
}

/** Devuelve el catálogo o lanza. No exige un número fijo de padecimientos. */
export function validateCatalog(catalog) {
  if (!catalog || catalog.schema !== CATALOG_SCHEMA) fail('esquema de catálogo inválido');
  if (!Array.isArray(catalog.diseases) || !catalog.diseases.length) fail('catálogo sin padecimientos');
  const ids = new Set();
  const releases = new Set();
  for (const d of catalog.diseases) {
    const where = `entrada ${d?.id}`;
    if (!d || typeof d !== 'object') fail('entrada no es objeto');
    if (typeof d.id !== 'string' || !ID_RE.test(d.id)) fail(`${where}: id inválido`);
    if (ids.has(d.id)) fail(`id duplicado: ${d.id}`);
    ids.add(d.id);
    if (d.kind !== 'legacy' && d.kind !== 'release') fail(`${where}: kind inválido`);
    for (const f of ['label', 'labelShort', 'cohort', 'url', 'page']) {
      if (typeof d[f] !== 'string' || !d[f].trim()) fail(`${where}: ${f} vacío`);
    }
    if (!SAFE_URL_RE.test(d.url) || !SAFE_URL_RE.test(d.page)) fail(`${where}: url/page no relativa segura`);
    if (d.cie !== null && typeof d.cie !== 'string') fail(`${where}: cie inválida`);
    if (d.kind === 'release') {
      if (typeof d.releaseId !== 'string' || !d.releaseId) fail(`${where}: release sin releaseId`);
      if (releases.has(d.releaseId)) fail(`releaseId duplicado: ${d.releaseId}`);
      releases.add(d.releaseId);
    } else if (d.releaseId !== null) fail(`${where}: legacy con releaseId`);
    if (!Number.isInteger(d.nSeries) || d.nSeries < 1) fail(`${where}: nSeries inválido`);
    if (!Array.isArray(d.sexes) || !d.sexes.length || new Set(d.sexes).size !== d.sexes.length
      || d.sexes.some((s) => !SEX_IDS.includes(s))) fail(`${where}: sexos inválidos`);
    const st = d.status;
    if (!st || !STATUS_KINDS.includes(st.kind) || typeof st.label !== 'string') fail(`${where}: estado inválido`);
    if ((d.kind === 'legacy') !== (st.kind === 'legacy')) fail(`${where}: estado incompatible con kind`);
    if (st.verdict === 'FAIL') fail(`${where}: veredicto FAIL no publicable`);
    checkWeek(d.origin, `${where}.origin`);
    checkWeek(d.lastObservation, `${where}.lastObservation`);
    if (d.lastIndex !== null && !isIso(d.lastIndex)) fail(`${where}: lastIndex inválido`);
    if (d.emittedAt !== null && typeof d.emittedAt !== 'string') fail(`${where}: emittedAt inválido`);
    if (!d.national || typeof d.national !== 'object') fail(`${where}: national ausente`);
    for (const [sx, n] of Object.entries(d.national)) {
      if (!d.sexes.includes(sx)) fail(`${where}: national.${sx} sin sexo declarado`);
      if (!n || (n.forecastTotal !== null && !isNum(n.forecastTotal)) || !Number.isInteger(n.forecastN)
        || !Array.isArray(n.spark)) fail(`${where}: national.${sx} inválido`);
      if (n.spark.some((p) => !Array.isArray(p) || !isIso(p[0]) || !isNum(p[1]))) fail(`${where}: spark inválido`);
    }
    if (d.sourceSha256 !== undefined && !/^[0-9a-f]{64}$/.test(d.sourceSha256)) fail(`${where}: sourceSha256 inválido`);
  }
  const s = catalog.summary;
  if (s) {
    if (s.diseases !== catalog.diseases.length) fail('summary.diseases no coincide');
    if (s.series !== catalog.diseases.reduce((a, d) => a + d.nSeries, 0)) fail('summary.series no coincide');
  }
  return catalog;
}

export function catalogEntry(catalog, id) {
  return catalog?.diseases?.find((d) => d.id === id) ?? null;
}

// ── datasets compatibles con data.mjs ───────────────────────────────────────
const ORDER = { nacional: 0, estado: 1, region: 2 };
const ESTADO_POS = new Map(ESTADOS.map((e, i) => [e.slug, i]));

function sortEntities(list) {
  return list.sort((a, b) => (ORDER[a.tipo] - ORDER[b.tipo])
    || ((ESTADO_POS.get(a.slug) ?? 0) - (ESTADO_POS.get(b.slug) ?? 0))
    || a.label.localeCompare(b.label, 'es'));
}

function normalizeLegacy(entry, payload) {
  const pad = PADECIMIENTOS.find((p) => p.id === entry.id);
  if (!pad) fail(`legacy desconocido: ${entry.id}`);
  if (!payload || typeof payload !== 'object') fail(`zoom ausente para ${entry.id}`);
  const base = buildIndex(payload, entry.id);
  let count = 0;
  for (const e of base.entities.values()) {
    for (const sx of entry.sexes) {
      const key = e.keys[sx];
      if (!key) fail(`legacy ${entry.id}/${e.slug} sin clave ${sx}`);
      const item = payload[key];
      const s = normalizeSeries(item);
      if (!s || s.d.length !== item.d.length) fail(`legacy ${key}: fechas inválidas`);
      for (let i = 1; i < s.d.length; i += 1) if (s.d[i] <= s.d[i - 1]) fail(`legacy ${key}: fechas desordenadas`);
      count += 1;
    }
  }
  if (Number.isInteger(entry.nSeries) && count !== entry.nSeries) {
    fail(`legacy ${entry.id}: ${count} series frente a ${entry.nSeries} del catálogo`);
  }
  return {
    entry,
    raw: payload,
    index: { padecimiento: entry, entities: base.entities },
    metadata: {
      kind: 'legacy',
      origin: entry.origin ?? null,
      lastObservation: entry.lastObservation ?? null,
      lastIndex: entry.lastIndex ?? null,
      emittedAt: null,
      status: entry.status,
      valuesRounded: true,
      casesLabel: 'Casos_semana (General); incrementos netos por sexo',
      source: { url: entry.url, sha256: entry.sourceSha256 ?? null, schema: 'zoom_data' },
      derivedHint: null,
    },
  };
}

function normalizeRelease(entry, payload) {
  const member = { disease_id: entry.id, release_id: entry.releaseId };
  assertView(payload, member);
  const status = statusFromView(payload);
  const origin = weekFromTuple(payload.origin, `${entry.id}.origin`);
  const cutoff = weekFromTuple(payload.observation_cutoff, `${entry.id}.observation_cutoff`);
  const raw = {};
  const entities = new Map();
  let portfolio = 0;
  for (const [vkey, s] of Object.entries(payload.series)) {
    const info = seriesEntityInfo(s, vkey);
    if (!SEX_IDS.includes(s.sexo)) fail(`serie ${vkey}: sexo desconocido ${s.sexo}`);
    checkPairs(s.observado, `${entry.id}/${vkey}/observado`);
    checkPairs(s.pronostico, `${entry.id}/${vkey}/pronostico`);
    const byDate = new Map();
    for (const [d, v] of s.observado) byDate.set(d, { r: v, y: null });
    for (const [d, v] of s.pronostico) {
      const cell = byDate.get(d) ?? { r: null, y: null };
      cell.y = v;
      byDate.set(d, cell);
    }
    const d = [...byDate.keys()].sort();
    const r = d.map((x) => byDate.get(x).r);
    const y = d.map((x) => byDate.get(x).y);
    let lastReal = null;
    for (const [dd, v] of s.observado) if (isNum(v)) lastReal = dd;
    const firstForecast = s.pronostico.length ? s.pronostico[0][0] : null;
    const key = `${s.nivel}|${s.id}|${s.sexo}`;
    if (raw[key]) fail(`clave duplicada ${key}`);
    const derived = s.motor === 'portfolio';
    if (derived) portfolio += 1;
    raw[key] = {
      motor: typeof s.motor === 'string' && s.motor ? s.motor : 'Sin dato',
      d, r, y,
      last_real: lastReal,
      ds_corte: firstForecast ? addDaysIso(firstForecast, -7) : null,
      corte_modelo: origin,
      ultima_semana_boletin: cutoff,
      intervalo_disponible: false,
      nivel: s.nivel,
      territorio_id: String(s.id),
      territorio: info.label,
      sexo: s.sexo,
      derivado: derived,
      pronostico_52_total: isNum(s.pronostico_52_total) ? s.pronostico_52_total : null,
    };
    if (!entities.has(info.slug)) entities.set(info.slug, { ...info, keys: {} });
    const ent = entities.get(info.slug);
    if (ent.keys[s.sexo]) fail(`serie duplicada ${info.slug}|${s.sexo} en ${entry.id}`);
    ent.keys[s.sexo] = key;
  }
  const count = Object.keys(raw).length;
  if (Number.isInteger(entry.nSeries) && count !== entry.nSeries) {
    fail(`release ${entry.id}: ${count} series frente a ${entry.nSeries} del catálogo`);
  }
  const sorted = sortEntities([...entities.values()]);
  return {
    entry,
    raw,
    index: { padecimiento: entry, entities: new Map(sorted.map((e) => [e.slug, e])) },
    metadata: {
      kind: 'release',
      releaseId: payload.release_id,
      origin,
      lastObservation: cutoff,
      lastIndex: payload.observation_cutoff_ds ?? null,
      emittedAt: payload.forecast_emitted_at ?? null,
      horizonWeeks: Number.isInteger(payload.horizon_weeks) ? payload.horizon_weeks : null,
      uncertaintyLabel: typeof payload.uncertainty_label === 'string' ? payload.uncertainty_label : null,
      observationDatasetId: payload.observation_dataset_id ?? null,
      status,
      valuesRounded: false,
      casesLabel: 'Casos semanales de la vista publicada (sin redondeo)',
      source: { url: entry.url, sha256: entry.sourceSha256 ?? null, schema: VIEW_SCHEMA },
      derivedHint: {
        models: Number.isInteger(payload.models) ? payload.models : null,
        products: count,
        portfolioProducts: portfolio,
        note: DERIVED_NOTE,
      },
      dsCorteRule: 'ds_corte = 7 días antes del primer pronóstico: frontera de clasificación del índice, no fecha de emisión',
    },
  };
}

/** {entry, raw, index, metadata} compatible con getSeries/rankEstados/motorDistribution. */
export function normalizeDataset(entry, payload) {
  if (!entry || typeof entry !== 'object') fail('entrada de catálogo ausente');
  if (entry.kind === 'legacy') return normalizeLegacy(entry, payload);
  if (entry.kind === 'release') return normalizeRelease(entry, payload);
  return fail(`kind desconocido: ${entry.kind}`);
}

/** Sexos existentes para el territorio (orden General, Hombres, Mujeres). */
export function datasetSexes(dataset, territory) {
  const ent = dataset?.index?.entities?.get(territory);
  if (!ent) return [];
  return SEX_IDS.filter((s) => Boolean(ent.keys[s]));
}

/**
 * Sexo efectivo. Si el pedido no existe: General si existe; si no, el primero disponible.
 * fallback=true obliga a la UI a avisar. Sin sexos: {sex:null, fallback:true}.
 */
export function resolveDatasetSex(dataset, territory, requested) {
  const list = datasetSexes(dataset, territory);
  if (list.includes(requested)) return { sex: requested, fallback: false };
  if (list.includes('general')) return { sex: 'general', fallback: true };
  return { sex: list[0] ?? null, fallback: true };
}
