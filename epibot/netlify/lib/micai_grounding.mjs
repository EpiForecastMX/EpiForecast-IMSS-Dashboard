/** Current MICAI facts for bounded FAQ intents. Values come from verified index cards,
 * not from a second hand-maintained numerical table. Other questions stay on the RAG path.
 *
 * Precedence (REVISION_INTEGRAL_2026-10-12, RI01–RI03): explicit other document → individual
 * geography → national comparison → follow-up → revision → identity/affiliations → provenance →
 * temporal pattern → remaining topics. Inherited MICAI context only applies when the new
 * question names no other source. Anything mixed or unclassified returns null (general path). */

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Other congresses, papers or conditions: never answered with MICAI cards.
const OTHER_DOC = /\b(wcp|congreso mundial|world congress|psiquiatria|psychiatry|calass|alass|helix|public health futures|skopje|plos|oneplus|patente|dengue|parkinson|alzheimer|obesidad|anorexia|preprint)\b|cita textual|texto literal/;

// The 32 federal entities and common aliases. Bare «mexico» is excluded on purpose
// (it names the country in most questions); the state needs «estado de mexico» or «edomex».
const STATES = [
  'aguascalientes', 'baja california', 'campeche', 'chiapas', 'chihuahua', 'ciudad de mexico', 'cdmx',
  'distrito federal', 'coahuila', 'colima', 'durango', 'guanajuato', 'guerrero', 'hidalgo', 'jalisco',
  'estado de mexico', 'edomex', 'edo mex', 'michoacan', 'morelos', 'nayarit', 'nuevo leon', 'oaxaca',
  'puebla', 'queretaro', 'quintana roo', 'san luis potosi', 'sinaloa', 'sonora', 'tabasco', 'tamaulipas',
  'tlaxcala', 'veracruz', 'yucatan', 'zacatecas',
];
const STATE_RE = new RegExp(`\\b(${STATES.join('|')})\\b|\\bpor (estado|entidad)\\b|\\bcada (estado|entidad)\\b`);

export function micaiIntent(query, history = []) {
  const q = norm(query);
  if (!q || q.length > 600) return null;
  if (OTHER_DOC.test(q)) return null;
  const explicit = /\bmicai\b/.test(q);
  const distinctive = /revision por serie/.test(q) && /prophet|optima/.test(q);
  const recent = history.slice(-4).some(h => /micai/.test(norm(h.text)));
  if (!(explicit || distinctive || recent)) return null;
  if (STATE_RE.test(q)) return null;  // individual geographies never get an aggregate card

  const naive = /ingenuo|naive/.test(q);
  if (/nacional/.test(q) && naive) return [8];
  if (/seguimiento/.test(q) && /archivad|ingenuo|naive|ensemble|prophet/.test(q)) return [11];
  if (/revision|revisar|reseleccion/.test(q) && /optima|prophet|ganancia|mediana|32\.7|28\.5/.test(q)) return [10];
  if (/afiliacion|quien(es)? (son|es|escribi|firma)|de donde son|institucion(es)? de los autores|lista de autores|autores del (micai|articulo|paper|trabajo)/.test(q)) return [4];
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

export function micaiGroundedAnswer(query, history, index) {
  const ids = micaiIntent(query, history);
  if (!ids) return null;
  const cards = ids.map(id => index.chunks.find(c => c.id === `micai-current#${id}`));
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
