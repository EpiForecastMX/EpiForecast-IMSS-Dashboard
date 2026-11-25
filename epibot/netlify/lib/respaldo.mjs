/**
 * respaldo.mjs — modelos de respaldo cuando Gemini no responde (25-nov-2026).
 *
 * Desde el 25-nov la clave de Gemini responde «402 Payment Required». Cuando Gemini falla por clave, facturación o cuota, o
 * cuando no hay clave, la función RAG prueba los respaldos en este orden:
 *
 * 1. DeepSeek, si existe `DEEPSEEK_API_KEY` (modelo `EPI_DEEPSEEK_MODELO`, por omisión `deepseek-flash`). En la comparación del
 *    25-nov-2026 (nueve prompts reales del RAG) respondió tan bien como Gemini, en 3 a 6 segundos (acta en
 *    planes/mesa_epibot_agentico_2026-11-25/respaldo_ollama/comparacion_modelos/VEREDICTO_PROVEEDORES.md).
 * 2. Ollama, si existe `EPI_LLM_RESPALDO="url|modelo"`. Sólo para desarrollo: llama3.1 y qwen2.5:14b cometieron errores
 *    clínicos, y Netlify no alcanza el Ollama de una computadora personal.
 *
 * Todo respaldo pasa por las mismas guardas y por el mismo verificador de cifras que Gemini (cifras_verificadas.mjs), y su
 * respuesta se rotula siempre. La clave la pone el autor en Netlify; nunca se imprime ni se registra.
 */

export const TIEMPO_RESPALDO = 60000;
export const TIEMPO_DEEPSEEK = 15000;
export const URL_DEEPSEEK = 'https://api.deepseek.com/chat/completions';

const AVISO_CLINICO = 'Las cifras se verificaron con los datos publicados; para información clínica consulta fuentes oficiales como MedlinePlus o la Secretaría de Salud._';
export const AVISOS = {
  deepseek: `\n\n_Esta respuesta la redactó un modelo de respaldo porque la IA principal no está disponible. ${AVISO_CLINICO}`,
  ollama: `\n\n_Esta respuesta la redactó un modelo local de respaldo, menos preciso, porque la IA principal no está disponible. ${AVISO_CLINICO}`,
};

/** «url|modelo» → { tipo: 'ollama', url, modelo } o null. */
export function specRespaldo(valor = process.env.EPI_LLM_RESPALDO) {
  if (!valor) return null;
  const [url, modelo] = String(valor).split('|');
  if (!/^https?:\/\//.test(url || '')) return null;
  return { tipo: 'ollama', url: url.replace(/\/$/, ''), modelo: modelo || 'llama3.1' };
}

/** DeepSeek si hay clave → { tipo: 'deepseek', modelo, clave } o null. */
export function specDeepSeek(env = process.env) {
  const clave = String(env.DEEPSEEK_API_KEY || '').trim();
  if (!clave) return null;
  return { tipo: 'deepseek', modelo: String(env.EPI_DEEPSEEK_MODELO || '').trim() || 'deepseek-flash', clave };
}

/** Respaldos configurados, en orden de preferencia. */
export function respaldos(env = process.env) {
  return [specDeepSeek(env), specRespaldo(env.EPI_LLM_RESPALDO)].filter(Boolean);
}

/** Nombre que se devuelve como `model` y se registra (nunca incluye la clave). */
export const etiqueta = (spec) => `${spec.tipo}:${spec.modelo}`;

/** Convierte el formato de Gemini (system + contents) en mensajes de chat (Ollama y DeepSeek usan el mismo). */
export function mensajesChat(system, contents) {
  return [{ role: 'system', content: system },
    ...contents.map((c) => ({ role: c.role === 'model' ? 'assistant' : 'user', content: (c.parts || []).map((p) => p.text || '').join('') }))];
}
export const mensajesOllama = mensajesChat;

async function conTiempo(timeoutMs, fn) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try { return await fn(ac.signal); } finally { clearTimeout(t); }
}

async function chatDeepSeek(spec, messages, { timeoutMs, json = false, temperature }) {
  return conTiempo(timeoutMs, async (signal) => {
    const r = await fetch(URL_DEEPSEEK, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${spec.clave}` },
      body: JSON.stringify({ model: spec.modelo, messages, temperature, stream: false,
        ...(json ? { response_format: { type: 'json_object' } } : {}) }),
    });
    if (!r.ok) throw new Error(`deepseek ${r.status}`);
    const j = await r.json();
    return String(j?.choices?.[0]?.message?.content || '');
  });
}

/** Genera una respuesta completa con Ollama; lanza un error si no responde a tiempo. */
export async function generaConOllama(spec, system, contents, { timeoutMs = TIEMPO_RESPALDO } = {}) {
  return conTiempo(timeoutMs, async (signal) => {
    const r = await fetch(`${spec.url}/api/chat`, {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: spec.modelo, messages: mensajesChat(system, contents), stream: false,
        options: { temperature: 0.2, num_ctx: 12288 } }),
    });
    if (!r.ok) throw new Error(`ollama ${r.status}`);
    const j = await r.json();
    return String(j?.message?.content || '');
  });
}

/** Genera una respuesta completa con el respaldo indicado. */
export function generaConRespaldo(spec, system, contents, { timeoutMs } = {}) {
  if (spec.tipo === 'deepseek') {
    return chatDeepSeek(spec, mensajesChat(system, contents), { timeoutMs: timeoutMs ?? TIEMPO_DEEPSEEK, temperature: 0.2 });
  }
  return generaConOllama(spec, system, contents, { timeoutMs: timeoutMs ?? TIEMPO_RESPALDO });
}

/** Generador JSON para el modo nlu (misma firma que generadorOllama de nlu.mjs). */
export function nluConOllama(spec, { timeoutMs = 20000 } = {}) {
  return async (prompt) => conTiempo(timeoutMs, async (signal) => {
    const r = await fetch(`${spec.url}/api/generate`, {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: spec.modelo, prompt, format: 'json', stream: false, options: { temperature: 0 } }),
    });
    if (!r.ok) throw new Error(`ollama ${r.status}`);
    return (await r.json()).response;
  });
}

/** Generador JSON para los modos nlu y plan con el respaldo indicado. */
export function nluConRespaldo(spec, { timeoutMs } = {}) {
  if (spec.tipo === 'deepseek') {
    return (prompt) => chatDeepSeek(spec, [{ role: 'user', content: prompt }], { timeoutMs: timeoutMs ?? 8000, json: true, temperature: 0 });
  }
  return nluConOllama(spec, { timeoutMs: timeoutMs ?? 20000 });
}
