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

function windowsOf(q) {
  const w = new Set();
  if (/historic|validacion cruzada|\bcv\b|tabla 1|seleccion historica/.test(q)) w.add('hist');
  if (/seguimiento|\bs19\b|\bs34\b|despues del articulo|16 semanas/.test(q)) w.add('B');
  if (/ventana del articulo|\bs03\b|panel (registrado )?(de )?2026|en el articulo/.test(q)) w.add('A');
  if (/reconstruccion|replay|\bs12\b|\bs11\b/.test(q)) w.add('replay');
  return w;
}
const estimatorsOf = q => EST_RE.filter(([, re]) => re.test(q)).map(([k]) => k);
function strataOf(q) {
  const s = [['general', /\bgeneral\b/], ['women', /\bmujeres\b/], ['men', /\bhombres\b/]]
    .filter(([, re]) => re.test(q)).map(([k]) => k);
  return s.length ? s : ['general', 'women', 'men'];
}
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

// ---- computed answers from the sealed metrics ------------------------------------------------------
const pct = v => `${v.toFixed(1)} %`;
const STRATUM = { general: 'general', women: 'mujeres', men: 'hombres' };
const WIN = { B: 'Seguimiento, ediciones S19–S34', A: 'Ventana del artículo, ediciones S03–S18' };
const median = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const geoName = k => (k === 'México' ? 'Estado de México' : k);
const UNAVAILABLE = { unavailable: true, error: 'La fuente actual del MICAI no está disponible; no se usará el preprint retirado.' };

function panelMedian(w, e) {
  const v = [];
  for (const g of Object.values(MICAI_STATES)) for (const s of Object.values(g)) v.push(s[w][e]);
  return median(v);
}
const verified = (answer, retrieval, sources) => ({ answer, model: 'verified-source', generated: false, retrieval, reranked: false, sources });
const abstention = text => ({ answer: text, model: 'abstention', generated: false, retrieval: 'no-verified-source', reranked: false, sources: [] });

function cardAnswer(chunks, ids) {
  const cards = ids.map(id => chunks.find(c => c.id === `micai-current#${id}`));
  if (cards.some(c => !c || !c.text || !c.url)) return UNAVAILABLE;
  return verified(cards.map((c, i) => `${c.text} [${i + 1}]`).join('\n\n'), 'curated-micai',
    cards.map((c, i) => ({ n: i + 1, source: c.source, title: c.title, section: c.section, url: c.url, snippet: c.text })));
}

function panelComparison(est, wins) {
  const lines = [];
  for (const w of wins) {
    const rows = est.map(e => [e, panelMedian(w, e)]).sort((a, b) => a[1] - b[1]);
    lines.push(`${WIN[w]} (99 objetivos, mediana de sMAPE, menor es mejor): ` +
      rows.map(([e, v]) => `${NAME[e]} ${pct(v)}`).join(', ') + `. Menor mediana: ${NAME[rows[0][0]]}.`);
  }
  lines.push('Es una comparación descriptiva de medianas: no significa que el modelo con menor mediana gane en cada objetivo, y los objetivos se superponen.');
  return verified(lines.join('\n\n') + ' [1]', 'micai-panel-metrics', [{ n: 1, source: 'Seguimiento MICAI 2026',
    title: 'MICAI 2026 · medianas del panel', section: 'Métricas por objetivo', url: '../micai2026.html#follow-up', snippet: lines[0] }]);
}

function geoAnswer(geos, est, wins, strata, q) {
  const shown = est.length ? est : ['archived', 'naive'];
  const blocks = [];
  for (const key of geos) {
    const s = MICAI_STATES[key];
    const engines = strata.map(k => NAME[s[k].engine] || s[k].engine);
    const assigned = engines.every(e => e === engines[0]) ? `${engines[0]}${strata.length === 3 ? ' en los tres estratos' : ''}`
      : strata.map((k, i) => `${STRATUM[k]} ${engines[i]}`).join(', ');
    const parts = [`${geoName(key)}: la asignación archivada es ${assigned}.`];
    for (const w of wins) {
      parts.push(`${WIN[w]} (sMAPE, menor es mejor): ` + strata.map(k =>
        `${STRATUM[k]}, ` + shown.map(e => `${NAME[e]} ${pct(s[k][w][e])}`).join(' frente a ')).join('; ') + '.');
    }
    blocks.push(parts.join(' '));
  }
  const lines = ['En el análisis MICAI (depresión, F32):', ...blocks,
    'Son cifras descriptivas de un objetivo por estrato; los objetivos se superponen y no incluyen la reconstrucción de la revisión por estado.'];
  if (seasonalAsked(q)) lines.push('Las fuentes no evalúan picos estacionales por estado; el patrón de la serie nacional no demuestra un patrón estatal.');
  lines.push('Corresponden al experimento MICAI, no a los modelos productivos actuales del sistema.');
  return verified(lines.join('\n\n') + ' [1]', 'micai-state-metrics', [{ n: 1, source: 'Seguimiento MICAI 2026',
    title: `MICAI 2026 · ${geos.map(geoName).join(', ')}`, section: 'Métricas por objetivo', url: '../micai2026.html#follow-up', snippet: blocks[0].slice(0, 300) }]);
}

// ---- entry point ---------------------------------------------------------------------------------
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

  const est = estimatorsOf(q);
  const wins = windowsOf(q);
  const geos = resolveStates(query);
  const followUp = /^[¿\s]*y (en|para|con)\b/.test(q) &&
    (history || []).filter(h => h && h.role === 'user').slice(-4).some(h => RESULTS.test(norm(h.text)));

  if (geos.length) {
    if (!(RESULTS.test(q) || followUp) || /\booad\b/.test(q)) return null;  // e.g. «la ponencia en Chihuahua»
    if (wins.has('hist') || wins.has('replay')) {
      return abstention('Las cifras por estado del MICAI disponibles aquí son las de la ventana del artículo (S03–S18) y del ' +
        'seguimiento (S19–S34); no incluyen la evidencia histórica ni la reconstrucción por estado.');
    }
    if (geos.length > 4) return abstention('Puedo comparar hasta cuatro geografías a la vez. Las 33 están en epiforecast.mx/micai2026.html, sección de seguimiento.');
    const ws = ['B', 'A'].filter(w => wins.has(w));
    return geoAnswer(geos, est, ws.length ? ws : ['B', 'A'], strataOf(q), q);
  }
  if (GENERIC_GEO.test(q)) return null;

  // Comparisons between estimators keep the requested window; with no window both are shown, labelled.
  const cardFirst = /nacional/.test(q) || /revision|reseleccion|reconstruccion/.test(q) ||
    (est.length === 2 && est.includes('archived') && est.includes('naive') && wins.has('B') && wins.size === 1);
  if (asksComparison(q, est) && !cardFirst) {
    if (wins.has('hist')) return wins.size === 1 ? cardAnswer(chunks, [6]) : null;
    if (!wins.has('replay')) {
      const ws = ['B', 'A'].filter(w => wins.has(w));
      return panelComparison(est, ws.length ? ws : ['B', 'A']);
    }
  }

  const ids = micaiIntent(query, history);
  return ids ? cardAnswer(chunks, ids) : null;
}
