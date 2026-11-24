/**
 * nlu.mjs — respaldo de comprensión con Gemini (rediseño conversacional, 24-nov-2026).
 *
 * Sólo cuando el EpiBot no reconoce ningún padecimiento en una frase («¿cómo anda lo del mosquito en Veracruz?», «el azúcar
 * en Monterrey»), el cliente pide a la función RAG `modo: 'nlu'`. Gemini devuelve JSON con un padecimiento de una lista
 * cerrada, el estado, el sexo, la intención y el periodo; aquí se valida campo por campo contra el catálogo y se arma una
 * consulta canónica en español que el KB local responde con sus propios datos. Gemini nunca da cifras ni texto al usuario:
 * si su salida no valida, no pasa nada y se sigue por la ruta normal. Los padecimientos sensibles no están en la lista.
 */

export const ESTADOS_32 = ['Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua',
  'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco',
  'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí',
  'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'];
const LEGACY = [
  { id: 'dengue', nombre: 'Dengue', consulta: 'dengue' },
  { id: 'depresion', nombre: 'Depresión', consulta: 'depresion' },
  { id: 'parkinson', nombre: 'Parkinson', consulta: 'parkinson' },
  { id: 'alzheimer', nombre: 'Alzheimer', consulta: 'alzheimer' },
];
export const INTENCIONES = ['estado_actual', 'tendencia', 'confiabilidad', 'definicion', 'ranking', 'otra'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Lista cerrada de padecimientos que Gemini puede elegir: los no sensibles del catálogo y los cuatro originales. */
export function catalogoNlu(releases) {
  return [...LEGACY, ...releases.filter((r) => !r.sensible)
    .map((r) => ({ id: r.id, nombre: r.nombre, consulta: r.consultaVisible || r.consulta }))];
}

export function promptNlu(consulta, cat) {
  return 'Eres el analizador de intención de un chatbot de epidemiología de México. NO respondas la pregunta: sólo clasifícala.\n' +
    'Devuelve EXCLUSIVAMENTE un objeto JSON con estas claves:\n' +
    '{"padecimiento": id de la lista o null, "estado": nombre exacto de la lista de estados o null, "sexo": "hombres" | "mujeres" | null, ' +
    `"intencion": uno de ${JSON.stringify(INTENCIONES)}, "periodo": "semana_pasada" | "proximo_mes" | nombre de un mes | un año de cuatro cifras | null}\n` +
    'Reglas: elige un padecimiento sólo si la frase lo nombra o lo describe sin ambigüedad (sinónimos coloquiales, síntomas típicos ' +
    'de un nombre explícito, errores de escritura); si dudas, null. Una ciudad se traduce a su estado. «ranking» es preguntar qué ' +
    'enfermedades suben o tienen más casos. «otra» es cualquier cosa que no sea preguntar por casos, tendencias, confiabilidad o ' +
    'qué es un padecimiento (tratamientos, síntomas propios, el proyecto, saludos).\n' +
    `PADECIMIENTOS (id: nombre): ${cat.map((c) => `${c.id}: ${c.nombre}`).join('; ')}\n` +
    `ESTADOS: ${ESTADOS_32.join('; ')}\n` +
    `FRASE: ${JSON.stringify(String(consulta).slice(0, 300))}`;
}

/** Valida la salida de Gemini contra las listas cerradas. Devuelve el objeto limpio o null. */
export function validaNlu(salida, cat) {
  let o = salida;
  if (typeof o === 'string') {
    try { o = JSON.parse(o.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { return null; }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const intencion = INTENCIONES.includes(o.intencion) ? o.intencion : null;
  if (!intencion || intencion === 'otra') return null;
  const pad = o.padecimiento == null ? null : cat.find((c) => c.id === o.padecimiento) || null;
  if (o.padecimiento != null && !pad) return null;
  const estado = o.estado == null ? null : ESTADOS_32.find((e) => e === o.estado) || null;
  if (o.estado != null && !estado) return null;
  const sexo = ['hombres', 'mujeres'].includes(o.sexo) ? o.sexo : null;
  const p = o.periodo == null ? null : String(o.periodo).toLowerCase();
  const periodo = p && (['semana_pasada', 'proximo_mes'].includes(p) || MESES.includes(p) || /^20[2-3]\d$/.test(p)) ? p : null;
  if (intencion !== 'ranking' && !pad) return null;
  return { pad, estado, sexo, intencion, periodo };
}

/** Consulta canónica en español que el KB local sabe responder. */
export function consultaCanonica(v) {
  if (!v) return null;
  if (v.intencion === 'ranking') return '¿qué enfermedades van al alza?';
  const base = v.pad.consulta;
  if (v.intencion === 'definicion') return `¿qué es ${base}?`;
  if (v.intencion === 'confiabilidad') return `¿qué tan confiable es el pronóstico de ${base}?`;
  const lugar = v.estado ? ` en ${v.estado}` : '';
  const sexo = v.sexo ? ` ${v.sexo}` : '';
  const periodo = !v.periodo ? '' : v.periodo === 'semana_pasada' ? ' la semana pasada' : v.periodo === 'proximo_mes' ? ' el próximo mes'
    : ` en ${v.periodo}`;
  if (v.intencion === 'tendencia') return `¿está subiendo ${base}${lugar}${sexo}${periodo}?`;
  return `¿cómo va ${base}${lugar}${sexo}${periodo}?`;
}

/**
 * Interpreta la frase con un modelo de Gemini (`generar(prompt) → texto`). Cualquier error, salida inválida o tiempo agotado
 * devuelve { consulta: null }.
 */
export async function interpretaConsulta(consulta, releases, generar) {
  const cat = catalogoNlu(releases);
  try {
    const texto = await generar(promptNlu(consulta, cat));
    let v = validaNlu(texto, cat);
    // El ranking sólo si la frase lo pide: un término inventado («zombificación») no se convierte en «¿qué va al alza?».
    const fn = String(consulta).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (v && v.intencion === 'ranking' && !/\b(enfermedad\w*|padecimiento\w*|sube\w*|subiendo|alza|aument\w*|mas casos|pega\w*|baja\w*|circulando)\b/.test(fn)) v = null;
    return { consulta: consultaCanonica(v), entendido: v ? { padecimiento: v.pad?.id ?? null, estado: v.estado, sexo: v.sexo, intencion: v.intencion, periodo: v.periodo } : null };
  } catch {
    return { consulta: null, entendido: null };
  }
}

/**
 * Generador local para desarrollo: Ollama (`EPI_LLM_LOCAL=http://localhost:11434|llama3.1`). Sólo se usa si la variable
 * existe; en producción el modo nlu usa Gemini. Devuelve el texto JSON del modelo.
 */
export function generadorOllama(spec, { timeoutMs = 20000 } = {}) {
  const [url, modelo] = String(spec).split('|');
  return async (prompt) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetch(`${url.replace(/\/$/, '')}/api/generate`, {
        method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelo || 'llama3.1', prompt, format: 'json', stream: false, options: { temperature: 0 } }),
      });
      if (!r.ok) throw new Error(`ollama ${r.status}`);
      return (await r.json()).response;
    } finally { clearTimeout(t); }
  };
}
