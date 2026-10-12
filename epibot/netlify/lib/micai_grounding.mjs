/** Current MICAI facts for bounded FAQ intents. Values come from verified index cards and from the
 * sealed per-target metrics (micai_states_data.mjs), never from a hand-maintained numerical table.
 * Other questions stay on the RAG path.
 *
 * Precedence (REVISION_INTEGRAL_2026-10-12 RI01–RI03; DICTAMEN_PR24 G01–G03):
 *   1. a document the index does not cover (WCP, CALASS…) → deterministic abstention, never a substitute;
 *   2. the retired May preprint → deterministic pointer to the accepted manuscript;
 *   3. MICAI + one geography → that geography's sealed metrics (no aggregate card, no production models);
 *   4. MICAI intents → verified cards; anything mixed or unclassified → null (general path). */

import { MICAI_STATES } from './micai_states_data.mjs';

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Documents outside the MICAI paper. Covered conditions (dengue, parkinson…) go to the general path.
const OTHER_DOCS = [
  { re: /\bwcp\b|congreso mundial|world congress/, label: 'el póster WCP 2026', page: 'epiforecast.mx/wcp2026.html', key: 'wcp' },
  { re: /\bcalass\b|\balass\b/, label: 'la ponencia CALASS 2026', page: 'epiforecast.mx/calass.html', key: 'calass' },
  { re: /\bhelix\b/, label: 'el HELIX 2026', page: 'epiforecast.mx/helix.html', key: 'helix' },
  { re: /public health futures|skopje/, label: 'Public Health Futures', page: 'epiforecast.mx/future_health.html', key: 'public health futures' },
  { re: /\boneplus\b|\bplos\b/, label: 'el manuscrito para PLOS ONE', page: null, key: 'plos' },
];
const OTHER_CONDITIONS = /\b(dengue|parkinson|alzheimer|obesidad|anorexia)\b/;
const QUOTES = /cita textual|texto literal/;

// The 32 federal entities and common aliases, mapped to the keys of MICAI_STATES. Bare «mexico» is
// excluded on purpose (it names the country in most questions).
const ALIASES = { cdmx: 'Ciudad de México', 'distrito federal': 'Ciudad de México', 'estado de mexico': 'México',
  edomex: 'México', 'edo mex': 'México' };
const STATE_KEYS = Object.keys(MICAI_STATES).filter(k => k !== 'Nacional' && k !== 'México');
const STATE_TERMS = [...STATE_KEYS.map(k => [norm(k), k]), ...Object.entries(ALIASES)]
  .sort((a, b) => b[0].length - a[0].length);
const STATE_RE = new RegExp(`\\b(${STATE_TERMS.map(t => t[0]).join('|')})\\b`);
const GENERIC_GEO = /\bpor (estado|entidad)\b|\bcada (estado|entidad)\b/;

function micaiContext(q, history) {
  const explicit = /\bmicai\b/.test(q);
  const distinctive = /revision por serie/.test(q) && /prophet|optima/.test(q);
  const recent = history.slice(-4).some(h => /micai/.test(norm(h.text)));
  return explicit || distinctive || recent;
}

export function resolveState(query) {
  const m = norm(query).match(STATE_RE);
  if (!m) return null;
  return (STATE_TERMS.find(([t]) => t === m[1]) || [])[1] || null;
}

export function micaiIntent(query, history = []) {
  const q = norm(query);
  if (!q || q.length > 600) return null;
  if (OTHER_DOCS.some(d => d.re.test(q)) || OTHER_CONDITIONS.test(q) || QUOTES.test(q) || /preprint/.test(q)) return null;
  if (!micaiContext(q, history)) return null;
  if (STATE_RE.test(q) || GENERIC_GEO.test(q)) return null;  // geographies never get an aggregate card

  const engines = /prophet|deepar|ensemble|stacking/;
  const naive = /ingenuo|naive/.test(q);
  if (/nacional/.test(q) && naive) return [8];
  if (/seguimiento/.test(q) && /archivad|ingenuo|naive|ensemble|prophet/.test(q)) return [11];
  if (/revision|revisar|reseleccion/.test(q) && /optima|prophet|ganancia|mediana|32\.7|28\.5/.test(q)) return [10];
  const asksContent = /que (dicen|concluyen|opinan|proponen|plantean|afirman)/.test(q);
  if (!asksContent && /\b(autor|autora|autores|autoras|coautor|coautora|coautores|coautoras)\b|afiliacion|institucion/.test(q)) return [4];
  if (/(de donde|fuente|origen|procedencia) (son|vienen|salen|de) (los )?datos|de donde (son|vienen|salen) los datos|fuente de (los )?datos|origen de (los )?datos/.test(q)) return [3];
  if (/\b(mejor|gana|gano|ganador|peor)\b/.test(q) && engines.test(q)) return [9];
  if (/fuga|prospectiv|fecha.*ejec|ejecut.*antes|congelad.*antes/.test(q)) return [5];
  const seasonalWord = /estacional/.test(q.replace(/(ingenuo|naive) estacional|seasonal naive/g, ''));
  if (/febrero|picos|saturacion/.test(q) || seasonalWord) return [7];
  if (/desagregacion/.test(q) && /aporte|aporta|para que|por que/.test(q)) return [15];
  if (/general|independientes|sexo/.test(q) && /mujeres|hombres|independ|suma/.test(q)) return [12, 3];
  if (/deepar/.test(q) && /6[.,]0|historic|entrenamiento|validacion/.test(q)) return [6];
  if (/99|111|denominador|cuantas.*series|cuantos.*objetivos|regiones/.test(q)) return [3];
  if (/contribucion|aporte principal|que aporta.*marco/.test(q)) return [0];
  return null;
}

const ENGINE = { deepar: 'DeepAR', prophet: 'Prophet', ensemble: 'Ensemble', stacking: 'Stacking' };
const STRATA = [['general', 'general'], ['women', 'mujeres'], ['men', 'hombres']];
const pct = v => `${v.toFixed(1)} %`;

function stateAnswer(key, q) {
  const s = MICAI_STATES[key];
  const name = key === 'México' ? 'Estado de México' : key;
  const engines = STRATA.map(([k]) => ENGINE[s[k].engine]);
  const assigned = engines.every(e => e === engines[0]) ? `${engines[0]} en los tres estratos`
    : STRATA.map(([, es], i) => `${es} ${engines[i]}`).join(', ');
  const win = w => STRATA.map(([k, es]) => `${es}, archivada ${pct(s[k][w].archived)} frente a ingenuo ${pct(s[k][w].naive)}`).join('; ');
  const seasonal = /febrero|picos|saturacion/.test(q) || /estacional/.test(q.replace(/(ingenuo|naive) estacional|seasonal naive/g, ''));
  const lines = [
    `En el análisis MICAI (depresión, F32), ${name}: la asignación archivada es ${assigned}.`,
    `Seguimiento, ediciones S19–S34 (sMAPE, menor es mejor): ${win('B')}.`,
    `Ventana del artículo, ediciones S03–S18: ${win('A')}.`,
    'Son cifras descriptivas de un objetivo por estrato; los objetivos se superponen y estas cifras no incluyen la reconstrucción de la revisión por estado.',
  ];
  if (seasonal) lines.push('Las fuentes no evalúan picos estacionales por estado; el patrón de la serie nacional no demuestra un patrón estatal.');
  lines.push('Corresponden al experimento MICAI, no a los modelos productivos actuales del sistema.');
  return {
    answer: lines.join('\n\n') + ' [1]',
    model: 'verified-source', generated: false, retrieval: 'micai-state-metrics', reranked: false,
    sources: [{ n: 1, source: 'Seguimiento MICAI 2026', title: `MICAI 2026 · ${name}`, section: 'Métricas por objetivo',
      url: '../micai2026.html#follow-up', snippet: lines[1] }],
  };
}

function abstention(text) {
  return { answer: text, model: 'abstention', generated: false, retrieval: 'no-verified-source', reranked: false, sources: [] };
}

export function micaiGroundedAnswer(query, history, index) {
  const q = norm(query);
  if (!q || q.length > 600) return null;
  const chunks = index?.chunks || [];
  const doc = OTHER_DOCS.find(d => d.re.test(q));
  if (doc) {
    const covered = chunks.some(c => norm(`${c.text} ${c.title} ${c.source}`).includes(doc.key));
    if (!covered) {
      return abstention(`No tengo en mis fuentes información verificada sobre ${doc.label}, así que no puedo responder eso ` +
        `ni sustituirlo con datos del MICAI o del equipo del proyecto.` + (doc.page ? ` Puedes consultarlo en ${doc.page}.` : ''));
    }
    return null;
  }
  if (/preprint/.test(q) && !QUOTES.test(q)) {
    return abstention('El preprint de mayo de 2026 se retiró. El EpiBot responde con el manuscrito aceptado del MICAI 2026, ' +
      'disponible en epiforecast.mx/micai2026.html.');
  }
  // The state table answers only questions about results; «la ponencia en Chihuahua» or «OOAD Guerrero» do not qualify.
  const RESULTS = /pronostic|seguimiento|ingenuo|naive|smape|error|asignacion|modelo|motor|picos|estacional|revision|resultado|desempeno|mediana|como (le fue|quedo|va|salio)/;
  const followUp = /^[¿\s]*y (en|para|con)\b/.test(q) && history.slice(-4).some(h => RESULTS.test(norm(h.text)));
  const aboutResults = RESULTS.test(q) || followUp;
  if (aboutResults && !/\booad\b/.test(q) && !OTHER_CONDITIONS.test(q) && !QUOTES.test(q) && micaiContext(q, history)) {
    const key = resolveState(query);
    if (key) return stateAnswer(key, q);
  }
  const ids = micaiIntent(query, history);
  if (!ids) return null;
  const cards = ids.map(id => chunks.find(c => c.id === `micai-current#${id}`));
  if (cards.some(c => !c || !c.text || !c.url)) {
    return { unavailable: true, error: 'La fuente actual del MICAI no está disponible; no se usará el preprint retirado.' };
  }
  return {
    answer: cards.map((c,i)=>`${c.text} [${i+1}]`).join('\n\n'),
    model: 'verified-source',
    generated: false,
    retrieval: 'curated-micai',
    reranked: false,
    sources: cards.map((c,i)=>({n:i+1,source:c.source,title:c.title,section:c.section,url:c.url,snippet:c.text})),
  };
}
