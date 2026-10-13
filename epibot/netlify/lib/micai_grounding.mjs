/** Deterministic MICAI answers. Values come from verified index cards and from the sealed per-target
 * metrics (micai_states_data.mjs, full precision, rounded once when shown). Other questions stay on
 * the RAG path.
 *
 * The question is resolved into fields before any answer is chosen (DICTAMEN_PR25):
 *   document  — from the current question, else from the latest USER message that names one (never from
 *               the assistant's own text, so an abstention that mentions MICAI does not reactivate it);
 *   window    — historical, paper (S03–S18), replay (S12–S18) or follow-up (S19–S34);
 *   geographies, strata and estimators — every one requested is kept.
 * An answer is returned only when it covers those fields; otherwise null (general path) or an explicit
 * abstention. Documents the index does not cover always get an abstention, never a substitute. */

import { MICAI_STATES } from './micai_states_data.mjs';

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---- documents -----------------------------------------------------------------------------------
const OTHER_DOCS = [
  { re: /\bwcp\b|congreso mundial|world congress/, label: 'el póster WCP 2026', page: 'epiforecast.mx/wcp2026.html', key: 'wcp' },
  { re: /\bcalass\b|\balass\b/, label: 'la ponencia CALASS 2026', page: 'epiforecast.mx/calass.html', key: 'calass' },
  { re: /\bhelix\b/, label: 'el HELIX 2026', page: 'epiforecast.mx/helix.html', key: 'helix' },
  { re: /public health futures|skopje/, label: 'Public Health Futures', page: 'epiforecast.mx/future_health.html', key: 'public health futures' },
  { re: /\boneplus\b|\bplos\b/, label: 'el manuscrito para PLOS ONE', page: null, key: 'plos' },
];
const OTHER_CONDITIONS = /\b(dengue|parkinson|alzheimer|obesidad|anorexia)\b/;
const QUOTES = /cita textual|texto literal/;
const MICAI_RE = /\bmicai\b/;
const DISTINCTIVE = q => /revision por serie/.test(q) && /prophet|optima/.test(q);

function docOf(text) {
  const t = norm(text);
  const d = OTHER_DOCS.find(x => x.re.test(t));
  if (d) return d;
  if (OTHER_CONDITIONS.test(t)) return 'condition';
  if (MICAI_RE.test(t)) return 'micai';
  return null;
}

/** Active document: the current question, else the latest user message that names one. */
export function activeDoc(query, history = []) {
  const own = docOf(query);
  if (own) return own;
  const users = (history || []).filter(h => h && h.role === 'user').slice(-4).reverse();
  for (const h of users) {
    const d = docOf(h.text);
    if (d) return d;
  }
  return null;
}

// ---- geographies ---------------------------------------------------------------------------------
// The 32 federal entities and common aliases, mapped to the keys of MICAI_STATES. Bare «mexico» is
// excluded on purpose (it names the country in most questions).
const ALIASES = { cdmx: 'Ciudad de México', 'distrito federal': 'Ciudad de México', 'estado de mexico': 'México',
  edomex: 'México', 'edo mex': 'México' };
const STATE_KEYS = Object.keys(MICAI_STATES).filter(k => k !== 'Nacional' && k !== 'México');
const STATE_TERMS = [...STATE_KEYS.map(k => [norm(k), k]), ...Object.entries(ALIASES)]
  .sort((a, b) => b[0].length - a[0].length);
const STATE_RE = new RegExp(`\\b(${STATE_TERMS.map(t => t[0]).join('|')})\\b`, 'g');
const GENERIC_GEO = /\bpor (estado|entidad)\b|\bcada (estado|entidad)\b/;

export function resolveStates(query) {
  const out = [];
  for (const m of norm(query).matchAll(STATE_RE)) {
    const key = (STATE_TERMS.find(([t]) => t === m[1]) || [])[1];
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}
export const resolveState = query => resolveStates(query)[0] || null;

// ---- fields --------------------------------------------------------------------------------------
const EST_RE = [['prophet', /\bprophet\b/], ['deepar', /\bdeepar\b/], ['ensemble', /\bensemble\b/],
  ['stacking', /\bstacking\b/], ['archived', /archivad/], ['naive', /ingenuo|naive/]];
const NAME = { prophet: 'Prophet', deepar: 'DeepAR', ensemble: 'Ensemble', stacking: 'Stacking',
  archived: 'asignación archivada', naive: 'ingenuo' };

// Explicit ranges must match a computed window at both ends (DICTAMEN_PR27 C1-02). Editions S03–S18 = A,
// S19–S34 = B; epidemiological periods W02–W17 = A, W18–W33 = B. Anything else is «unsupported».
const RANGE_RE = /\b([sw])\s?(\d{1,2})\s*(?:–|-|a|al|hasta)\s*([sw])?\s?(\d{1,2})\b/g;
function rangesOf(q) {
  const out = [];
  for (const m of q.matchAll(RANGE_RE)) {
    const kind = m[1], a = Number(m[2]), b = Number(m[4]);
    if (m[3] && m[3] !== kind) { out.push('unsupported'); continue; }
    const ok = kind === 's' ? { '3-18': 'A', '19-34': 'B' } : { '2-17': 'A', '18-33': 'B' };
    out.push(ok[`${a}-${b}`] || 'unsupported');
  }
  return out;
}

function windowsOf(q) {
  const w = new Set();
  if (/historic|validacion cruzada|\bcv\b|tabla 1|seleccion historica/.test(q)) w.add('hist');
  if (/seguimiento|despues del articulo|16 semanas/.test(q)) w.add('B');
  if (/ventana del articulo|panel (registrado )?(de )?2026|en el articulo/.test(q)) w.add('A');
  for (const r of rangesOf(q)) w.add(r);
  if (/reconstruccion|replay|\bs12\b|\bs11\b/.test(q)) w.add('replay');
  return w;
}
const estimatorsOf = q => EST_RE.filter(([, re]) => re.test(q)).map(([k]) => k);
const asksComparison = (q, est) => est.length >= 2 || (est.length >= 1 && /\b(mejor|gana|gano|ganador|peor|frente|versus|vs|compar)/.test(q));
const seasonalAsked = q => /febrero|picos|saturacion/.test(q) || /estacional/.test(q.replace(/(ingenuo|naive) estacional|seasonal naive/g, ''));
const RESULTS = /pronostic|seguimiento|ingenuo|naive|smape|error|asignacion|modelo|motor|picos|estacional|revision|resultado|desempeno|mediana|mejor|peor|gana|prophet|deepar|ensemble|stacking|como (le fue|quedo|va|salio)/;

// ---- card intents (aggregate questions) -----------------------------------------------------------
export function micaiIntent(query, history = []) {
  const q = norm(query);
  if (!q || q.length > 600) return null;
  if (activeDoc(query, history) !== 'micai' && !DISTINCTIVE(q)) return null;
  if (QUOTES.test(q) || /preprint/.test(q)) return null;
  if (resolveStates(query).length || GENERIC_GEO.test(q)) return null;  // geographies never get an aggregate card

  const naive = /ingenuo|naive/.test(q);
  if (/nacional/.test(q) && naive) return [8];
  if (/seguimiento/.test(q) && /archivad/.test(q) && naive) return [11];
  if (/revision|revisar|reseleccion/.test(q) && /optima|prophet|ganancia|mediana|32\.7|28\.5/.test(q)) return [10];
  const asksContent = /que (dicen|concluyen|opinan|proponen|plantean|afirman)/.test(q);
  if (!asksContent && /\b(autor|autora|autores|autoras|coautor|coautora|coautores|coautoras)\b|afiliacion|institucion/.test(q)) return [4];
  if (/(de donde|fuente|origen|procedencia) (son|vienen|salen|de) (los )?datos|de donde (son|vienen|salen) los datos|fuente de (los )?datos|origen de (los )?datos/.test(q)) return [3];
  if (/fuga|prospectiv|fecha.*ejec|ejecut.*antes|congelad.*antes/.test(q)) return [5];
  if (seasonalAsked(q)) return [7];
  if (/desagregacion/.test(q) && /aporte|aporta|para que|por que/.test(q)) return [15];
  if (/general|independientes|sexo/.test(q) && /mujeres|hombres|independ|suma/.test(q)) return [12, 3];
  if (/deepar/.test(q) && /6[.,]0|historic|entrenamiento|validacion/.test(q)) return [6];
  if (/99|111|denominador|cuantas.*series|cuantos.*objetivos|regiones/.test(q)) return [3];
  if (/contribucion|aporte principal|que aporta.*marco/.test(q)) return [0];
  return null;
}

// ---- metric and the active query ---------------------------------------------------------------------
/** sMAPE (%) and MAE (cases) are available per target; anything else is not answered from these data. */
function metricOf(q) {
  if (/\bmase\b|\brmse\b|error cuadratico|desviacion acumulada|\bmape\b/.test(q)) return 'unsupported';
  const mae = /\bmae\b|error absoluto/.test(q), smape = /\bsmape\b/.test(q);
  if (mae && smape) return 'several';  // DICTAMEN_PR27 C1-03: one metric per answer
  if (mae) return 'mae';
  if (smape) return 'smape';
  return null;
}
function explicitStrata(q) {
  return [['general', /\bgeneral\b/], ['women', /\bmujeres\b/], ['men', /\bhombres\b/]].filter(([, re]) => re.test(q)).map(([k]) => k);
}
const NATIONAL = /\bnacional\b/;
const isFollowUp = q => /^[¿\s]*y\b/.test(q) && q.length < 120;

/** The fields of the current question; a follow-up («¿Y en Puebla?») inherits the previous user question's
 * fields and changes only those it names (DICTAMEN_PR26 P26-02). */
function fieldsOf(text) {
  const q = norm(text);
  return { est: estimatorsOf(q), wins: windowsOf(q), strata: explicitStrata(q), metric: metricOf(q),
    geos: resolveStates(text), national: NATIONAL.test(q) };
}
function overlay(base, own) {
  const newGeo = own.geos.length || own.national;
  return {
    est: own.est.length ? own.est : base.est,
    wins: own.wins.size ? own.wins : base.wins,
    strata: own.strata.length ? own.strata : base.strata,
    metric: own.metric || base.metric,
    geos: newGeo ? own.geos : base.geos,
    national: newGeo ? own.national : base.national,
  };
}

/** The fields of the current question. A follow-up («¿Y en Puebla?», «¿Y para hombres?») is resolved on top of
 * the user's previous turns: from the latest non-follow-up question among the last four, each follow-up changes
 * only the fields it names (DICTAMEN_PR26 P26-02, DICTAMEN_PR27 C1-01). */
export function resolveFields(query, history = []) {
  const q = norm(query);
  const own = fieldsOf(query);
  if (!isFollowUp(q)) return { ...own, followUp: false };
  const users = (history || []).filter(h => h && h.role === 'user').slice(-4).map(h => h.text || '');
  let start = -1;
  for (let k = users.length - 1; k >= 0; k--) if (!isFollowUp(norm(users[k]))) { start = k; break; }
  if (start < 0) return { ...own, followUp: false };
  let acc = fieldsOf(users[start]);
  for (const u of users.slice(start + 1)) acc = overlay(acc, fieldsOf(u));
  return { ...overlay(acc, own), followUp: true, prevResults: RESULTS.test(norm(users[start])) };
}

// ---- computed answers from the sealed metrics ------------------------------------------------------
const STRATUM = { general: 'general', women: 'mujeres', men: 'hombres' };
const WIN = { B: 'Seguimiento, ediciones S19–S34', A: 'Ventana del artículo, ediciones S03–S18' };
const median = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const geoName = k => (k === 'México' ? 'Estado de México' : k);
const UNAVAILABLE = { unavailable: true, error: 'La fuente actual del MICAI no está disponible; no se usará el preprint retirado.' };
const METRIC = {
  smape: { label: 'sMAPE', fmt: v => `${v.toFixed(1)} %`, get: (s, w, e) => s[w][e] },
  mae: { label: 'MAE, en casos', fmt: v => `${v.toFixed(1)} casos`, get: (s, w, e) => s.mae[w][e] },
};
const ALL_STRATA = ['general', 'women', 'men'];

function panelMedian(w, e, strata, m) {
  const v = [];
  for (const g of Object.values(MICAI_STATES)) for (const k of strata) v.push(METRIC[m].get(g[k], w, e));
  return median(v);
}
function denominator(strata) {
  const n = 33 * strata.length;
  if (strata.length === 3) return `${n} objetivos`;
  return `${n} objetivos de ${strata.map(k => STRATUM[k]).join(' y ')}`;
}
const verified = (answer, retrieval, sources) => ({ answer, model: 'verified-source', generated: false, retrieval, reranked: false, sources });
const abstention = text => ({ answer: text, model: 'abstention', generated: false, retrieval: 'no-verified-source', reranked: false, sources: [] });

function cardAnswer(chunks, ids) {
  const cards = ids.map(id => chunks.find(c => c.id === `micai-current#${id}`));
  if (cards.some(c => !c || !c.text || !c.url)) return UNAVAILABLE;
  return verified(cards.map((c, i) => `${c.text} [${i + 1}]`).join('\n\n'), 'curated-micai',
    cards.map((c, i) => ({ n: i + 1, source: c.source, title: c.title, section: c.section, url: c.url, snippet: c.text })));
}

/** One named model is compared with the naive (or the archived assignment with the naive). */
const withComparator = est => (est.length >= 2 ? est : est.length === 1 ? [est[0], est[0] === 'naive' ? 'archived' : 'naive'] : ['archived', 'naive']);

function panelComparison(est, wins, strata, m) {
  est = withComparator(est);
  const lines = [];
  for (const w of wins) {
    const rows = est.map(e => [e, panelMedian(w, e, strata, m)]).sort((a, b) => a[1] - b[1]);
    lines.push(`${WIN[w]} (${denominator(strata)}, mediana de ${METRIC[m].label}, menor es mejor): ` +
      rows.map(([e, v]) => `${NAME[e]} ${METRIC[m].fmt(v)}`).join(', ') + `. Menor mediana: ${NAME[rows[0][0]]}.`);
  }
  if (m === 'mae') lines.push('MAE se expresa en casos; no es sMAPE ni un porcentaje.');
  lines.push('Es una comparación descriptiva de medianas: no significa que el modelo con menor mediana gane en cada objetivo, y los objetivos se superponen.');
  return verified(lines.join('\n\n') + ' [1]', 'micai-panel-metrics', [{ n: 1, source: 'Seguimiento MICAI 2026',
    title: 'MICAI 2026 · medianas del panel', section: 'Métricas por objetivo', url: '../micai2026.html#follow-up', snippet: lines[0] }]);
}

function geoAnswer(geos, est, wins, strata, m, q) {
  const shown = withComparator(est);
  const blocks = [];
  for (const key of geos) {
    const s = MICAI_STATES[key];
    const engines = strata.map(k => NAME[s[k].engine] || s[k].engine);
    const assigned = engines.every(e => e === engines[0]) ? `${engines[0]}${strata.length === 3 ? ' en los tres estratos' : ''}`
      : strata.map((k, i) => `${STRATUM[k]} ${engines[i]}`).join(', ');
    const parts = [`${geoName(key)}: la asignación archivada es ${assigned}.`];
    for (const w of wins) {
      parts.push(`${WIN[w]} (${METRIC[m].label}, menor es mejor): ` + strata.map(k =>
        `${STRATUM[k]}, ` + shown.map(e => `${NAME[e]} ${METRIC[m].fmt(METRIC[m].get(s[k], w, e))}`).join(' frente a ')).join('; ') + '.');
    }
    blocks.push(parts.join(' '));
  }
  const lines = ['En el análisis MICAI (depresión, F32):', ...blocks];
  if (m === 'mae') lines.push('MAE se expresa en casos; no es sMAPE ni un porcentaje.');
  lines.push('Son cifras descriptivas de un objetivo por estrato; los objetivos se superponen y no incluyen la reconstrucción de la revisión por estado.');
  if (seasonalAsked(q)) lines.push('Las fuentes no evalúan picos estacionales por estado; el patrón de la serie nacional no demuestra un patrón estatal.');
  lines.push('Corresponden al experimento MICAI, no a los modelos productivos actuales del sistema.');
  return verified(lines.join('\n\n') + ' [1]', 'micai-state-metrics', [{ n: 1, source: 'Seguimiento MICAI 2026',
    title: `MICAI 2026 · ${geos.map(geoName).join(', ')}`, section: 'Métricas por objetivo', url: '../micai2026.html#follow-up', snippet: blocks[0].slice(0, 300) }]);
}

// ---- entry point ---------------------------------------------------------------------------------
const UNSUPPORTED_METRIC = 'Estas respuestas por objetivo solo tienen sMAPE y MAE. No puedo responder sobre MASE, RMSE, MAPE ' +
  'o la desviación acumulada con esas cifras, ni sustituirlas por otra métrica.';

export function micaiGroundedAnswer(query, history, index) {
  const q = norm(query);
  if (!q || q.length > 600) return null;
  const chunks = index?.chunks || [];
  const doc = activeDoc(query, history);

  if (doc && typeof doc === 'object') {  // another document, named now or still active from the user's turns
    const covered = chunks.some(c => norm(`${c.text} ${c.title} ${c.source}`).includes(doc.key));
    if (covered) return null;
    return abstention(`No tengo en mis fuentes información verificada sobre ${doc.label}, así que no puedo responder eso ` +
      'ni sustituirlo con datos del MICAI o del equipo del proyecto.' + (doc.page ? ` Puedes consultarlo en ${doc.page}.` : ''));
  }
  if (/preprint/.test(q) && !QUOTES.test(q)) {
    return abstention('El preprint de mayo de 2026 se retiró. El EpiBot responde con el manuscrito aceptado del MICAI 2026, ' +
      'disponible en epiforecast.mx/micai2026.html.');
  }
  if (!(doc === 'micai' || DISTINCTIVE(q)) || QUOTES.test(q)) return null;

  const f = resolveFields(query, history);
  if (f.wins.has('unsupported')) {
    return abstention('Las métricas calculadas disponibles aquí corresponden a las ediciones S03–S18 (ventana del artículo) y ' +
      'S19–S34 (seguimiento). Esta respuesta no cubre el rango que pides y no lo sustituiré por otro.');
  }
  if (f.metric === 'several') return abstention('Puedo comparar una métrica a la vez. Has pedido sMAPE y MAE; dime cuál quieres.');
  const strata = f.strata.length ? f.strata : ALL_STRATA;
  const m = f.metric || 'smape';
  const results = RESULTS.test(q) || (f.followUp && f.prevResults) || f.metric === 'mae';

  // National is a geography whenever the question goes beyond the general national card (stratum, models, metric).
  // The national card answers the general national target against the naive; any other combination is computed
  // from the Nacional row (DICTAMEN_PR27 C1-04: a single model without «ingenuo» is compared with the naive).
  const nationalCard = f.national && !f.followUp && m === 'smape' && f.strata.every(k => k === 'general') &&
    f.est.includes('naive') && f.est.every(e => ['ensemble', 'naive'].includes(e));
  const nationalComputed = f.national && !nationalCard &&
    (f.est.length > 0 || f.strata.length > 0 || f.metric !== null || f.followUp);
  const geos = [...(nationalComputed ? ['Nacional'] : []), ...f.geos];

  if (geos.length) {
    if (!results || /\booad\b/.test(q)) return null;  // e.g. «la ponencia en Chihuahua»
    if (f.metric === 'unsupported') return abstention(UNSUPPORTED_METRIC);
    if (f.wins.has('hist') || f.wins.has('replay')) {
      return abstention('Las cifras por estado del MICAI disponibles aquí son las de la ventana del artículo (S03–S18) y del ' +
        'seguimiento (S19–S34); no incluyen la evidencia histórica ni la reconstrucción por estado.');
    }
    if (geos.length > 4) return abstention('Puedo comparar hasta cuatro geografías a la vez. Las 33 están en epiforecast.mx/micai2026.html, sección de seguimiento.');
    const ws = ['B', 'A'].filter(w => f.wins.has(w));
    return geoAnswer(geos, f.est, ws.length ? ws : ['B', 'A'], strata, m, q);
  }
  if (GENERIC_GEO.test(q)) return null;

  // Comparisons between estimators keep the requested window, strata and metric; with no window both are shown.
  const card11 = f.est.length === 2 && f.est.includes('archived') && f.est.includes('naive') && f.wins.has('B') &&
    f.wins.size === 1 && !f.strata.length && m === 'smape';
  const cardFirst = (f.national && !nationalComputed) || /revision|reseleccion|reconstruccion/.test(q) || card11;
  if (asksComparison(q, f.est) && !cardFirst) {
    if (f.metric === 'unsupported') return abstention(UNSUPPORTED_METRIC);
    if (f.wins.has('hist')) return f.wins.size === 1 && m === 'smape' && !f.strata.length ? cardAnswer(chunks, [6]) : null;
    if (!f.wins.has('replay')) {
      const ws = ['B', 'A'].filter(w => f.wins.has(w));
      return panelComparison(f.est, ws.length ? ws : ['B', 'A'], strata, m);
    }
  }
  if (f.metric === 'mae' || f.metric === 'unsupported') return f.metric === 'unsupported' ? abstention(UNSUPPORTED_METRIC) : null;

  const ids = micaiIntent(query, history);
  return ids ? cardAnswer(chunks, ids) : null;
}
